import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount, requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  verifyPhoneNumber,
  registerPhoneNumber,
  subscribeWabaToApp,
} from "@/lib/whatsapp/meta-api";
import { encrypt, decrypt } from "@/lib/whatsapp/encryption";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Service client for cross-tenant uniqueness checks
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _adminClient;
}

/**
 * GET /api/whatsapp/onboarding
 *
 * Checks live Meta WhatsApp Cloud API connection status, phone health, and quality rating.
 */
export async function GET(_req: NextRequest) {
  try {
    const ctx = await getCurrentAccount();

    const { data: config, error: configError } = await ctx.supabase
      .from("whatsapp_config")
      .select("phone_number_id, waba_id, access_token, status, registered_at, subscribed_apps_at, last_registration_error")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (configError || !config || !config.phone_number_id || !config.access_token) {
      return NextResponse.json({
        connected: false,
        reason: "not_configured",
        message: "WhatsApp Business API is not connected yet.",
      });
    }

    let accessToken: string;
    try {
      accessToken = decrypt(config.access_token);
    } catch {
      return NextResponse.json({
        connected: false,
        reason: "token_corrupted",
        message: "Stored access token cannot be decrypted with current encryption key.",
      });
    }

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      });

      return NextResponse.json({
        connected: true,
        phoneInfo,
        config: {
          phoneNumberId: config.phone_number_id,
          wabaId: config.waba_id,
          registeredAt: config.registered_at,
          subscribedAppsAt: config.subscribed_apps_at,
          status: config.status,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Meta API validation failed";
      return NextResponse.json({
        connected: false,
        reason: "meta_api_error",
        message,
        config: {
          phoneNumberId: config.phone_number_id,
          wabaId: config.waba_id,
          registeredAt: config.registered_at,
          subscribedAppsAt: config.subscribed_apps_at,
          status: "error",
        },
      });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/whatsapp/onboarding
 *
 * Connects or updates WhatsApp Business API credentials for the organization.
 * Guarded by requireRole('admin') — only admins/owners may configure API keys.
 * Performs zero-cross-talk validation, Meta live verification, automated registration, and app subscription.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole("admin");
    const body = await req.json();

    const {
      phone_number_id,
      waba_id,
      access_token,
      pin,
      verify_token = "wacrm_meta_verify_token",
    } = body;

    if (!phone_number_id || !access_token) {
      return NextResponse.json(
        { error: "Phone Number ID and Access Token are required." },
        { status: 400 },
      );
    }

    if (pin && (typeof pin !== "string" || !/^\d{6}$/.test(pin))) {
      return NextResponse.json(
        { error: "Two-step verification PIN must be exactly 6 digits." },
        { status: 400 },
      );
    }

    // 1. Check for cross-tenant conflict: Ensure this phone_number_id is not claimed by another account
    const { data: claimed, error: claimErr } = await supabaseAdmin()
      .from("whatsapp_config")
      .select("account_id")
      .eq("phone_number_id", phone_number_id)
      .neq("account_id", ctx.accountId)
      .maybeSingle();

    if (claimErr) {
      console.error("[whatsapp/onboarding] Error checking number claim:", claimErr);
    } else if (claimed) {
      return NextResponse.json(
        {
          error:
            "This WhatsApp phone number is already connected to another organization. Each official WhatsApp number can only be bound to a single tenant account.",
        },
        { status: 409 },
      );
    }

    // 2. Validate credentials against Meta Graph API
    let phoneInfo;
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken: access_token,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Meta credentials verification failed";
      return NextResponse.json(
        { error: `Meta API verification rejected: ${errMsg}` },
        { status: 400 },
      );
    }

    // 3. Automated Cloud API Registration (if PIN provided)
    let registeredAt = null;
    let registrationError = null;
    if (pin) {
      try {
        const regResult = await registerPhoneNumber({
          phoneNumberId: phone_number_id,
          accessToken: access_token,
          pin,
        });
        if (regResult.success) {
          registeredAt = new Date().toISOString();
        }
      } catch (err) {
        registrationError = err instanceof Error ? err.message : "Registration failed";
        console.warn("[whatsapp/onboarding] /register non-fatal warning:", registrationError);
      }
    }

    // 4. Automated WABA Webhook App Subscription
    let subscribedAppsAt = null;
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: access_token,
        });
        subscribedAppsAt = new Date().toISOString();
      } catch (err) {
        console.warn("[whatsapp/onboarding] /subscribed_apps warning:", err);
      }
    }

    // 5. Encrypt token and persist in whatsapp_config
    const encryptedToken = encrypt(access_token);
    const now = new Date().toISOString();

    const { error: upsertErr } = await supabaseAdmin()
      .from("whatsapp_config")
      .upsert(
        {
          account_id: ctx.accountId,
          user_id: ctx.userId,
          phone_number_id,
          waba_id: waba_id || null,
          access_token: encryptedToken,
          verify_token,
          status: "connected",
          registered_at: registeredAt || now,
          subscribed_apps_at: subscribedAppsAt || now,
          last_registration_error: registrationError,
          updated_at: now,
        },
        { onConflict: "account_id" },
      );

    if (upsertErr) {
      console.error("[whatsapp/onboarding] DB upsert error:", upsertErr);
      return NextResponse.json({ error: "Failed to save WhatsApp configuration." }, { status: 500 });
    }

    // 6. Security Audit Log
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    await supabaseAdmin().from("saas_audit_logs").insert({
      actor_user_id: ctx.userId,
      actor_email: "admin",
      action: "whatsapp.waba_connected",
      target_account_id: ctx.accountId,
      details: {
        phone_number_id,
        waba_id,
        display_phone_number: phoneInfo.display_phone_number,
        verified_name: phoneInfo.verified_name,
        quality_rating: phoneInfo.quality_rating,
      },
      ip_address: ipAddress,
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      phoneInfo,
      registered: Boolean(registeredAt),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
