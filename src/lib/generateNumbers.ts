import { supabase } from './supabase'




export async function generateReceiptNumber(sellerId: string): Promise<string> {
  const currentYear = new Date().getFullYear()

  // Fetch the seller's profile to get the shortcut
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('shortcut')
    .eq('id', sellerId)
    .single()

  if (profileError || !profile?.shortcut) {
    throw new Error('Failed to fetch seller profile')
  }

  // Fetch the latest receipt for this seller in the current year
  const { data: latestReceipt, error: receiptError } = await supabase
    .from('receipts')
    .select('receipt_no')
    .eq('seller_id', sellerId)
    .like('receipt_no', `${currentYear}.${profile.shortcut}.%`)
    .order('receipt_no', { ascending: false })
    .limit(1)
    .single()

  if (receiptError && receiptError.code !== 'PGRST116') {
    throw new Error('Chybí poslední číslo')
  }

  let increasingNumber = 1
  if (latestReceipt) {
    const parts = latestReceipt.receipt_no.split('.')
    const lastYear = parseInt(parts[0], 10)

    console.log("Latest Receipt:", latestReceipt)

    if (lastYear !== currentYear) {
      increasingNumber = 1
    } else {
      const lastNumberPart = parts[parts.length - 1]
      increasingNumber = parseInt(lastNumberPart, 10) + 1
    }
  }

  console.log("Increasing Number:", increasingNumber)

  const newReceiptNumber = `${currentYear}.${profile.shortcut}.${increasingNumber.toString().padStart(6, '0')}`
  console.log("New Receipt Number:", newReceiptNumber)

  return newReceiptNumber
}