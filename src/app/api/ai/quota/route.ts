import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { checkAiQuota } from '@/lib/ai/quota'

/**
 * GET /api/ai/quota
 *
 * Returns the current organization's AI usage quota status:
 * - allowed: boolean (whether tokens remain or BYO-key is configured)
 * - hasByoKey: boolean
 * - monthlyUsed: number
 * - monthlyQuota: number | null
 * - remaining: number | null
 * - resetsAt: ISO string timestamp
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const quota = await checkAiQuota(supabase, accountId)

    return NextResponse.json({ quota })
  } catch (err) {
    return toErrorResponse(err)
  }
}
