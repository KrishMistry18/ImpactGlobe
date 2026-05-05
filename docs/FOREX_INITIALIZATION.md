# Forex Pairs Initialization Guide

## Problem

Only AUD/USD is showing in the Top Movers panel, and it's 4 hours old.

### Why This Happened

1. **Rotating System**: The forex refresh system updates ONE pair per minute to save API credits
2. **Cron Schedule**: The cron job was set to run only during market hours (Mon-Fri 8am-6pm UTC)
3. **Empty Cache**: Other pairs haven't been initialized yet or the cache expired

---

## Solution 1: Initialize All Pairs at Once (RECOMMENDED)

This will fetch all 5 forex pairs immediately.

### Step 1: Get Your Admin Secret

Check your `.env.local` file for:
```bash
ADMIN_SECRET=your_admin_secret
```

### Step 2: Call the Init Endpoint

**Using PowerShell:**
```powershell
$headers = @{
    "x-admin-secret" = "your_admin_secret_here"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/forex/init" -Headers $headers -Method Get
```

**Using curl (Git Bash):**
```bash
curl -H "x-admin-secret: your_admin_secret_here" http://localhost:3000/api/forex/init
```

**Using browser:**
1. Install a browser extension like "ModHeader" or "Simple Modify Headers"
2. Add header: `x-admin-secret: your_admin_secret_here`
3. Navigate to: `http://localhost:3000/api/forex/init`

### Step 3: Wait

The initialization will take about **1-2 minutes** because it:
- Fetches each pair with 10-second delays
- Uses 10 API credits total (2 per pair × 5 pairs)

### Step 4: Verify

Refresh your browser and check the Top Movers panel. You should see all 5 pairs:
- EUR/USD
- GBP/USD
- USD/JPY
- AUD/USD
- USD/CAD

---

## Solution 2: Wait for Rotating Updates

If you don't want to use API credits now, just wait. The system will update:
- **Minute 0, 5, 10, 15...**: EUR/USD
- **Minute 1, 6, 11, 16...**: GBP/USD
- **Minute 2, 7, 12, 17...**: USD/JPY
- **Minute 3, 8, 13, 18...**: AUD/USD
- **Minute 4, 9, 14, 19...**: USD/CAD

**Full cycle: 5 minutes**

After 5 minutes, all pairs will be updated.

---

## Solution 3: Manual Refresh via UI

Click the **refresh button** in the Top Movers panel. This will:
1. Trigger a manual refresh of the current pair
2. Update the cache
3. Show the latest data

---

## Understanding the Cron Schedule

### Old Schedule (Market Hours Only)
```json
"schedule": "*/2 8-18 * * 1-5"
```
- Every 2 minutes
- Only 8am-6pm UTC
- Only Monday-Friday
- ~330 calls/day × 2 credits = 660 credits/day ✅ Under 800 limit

### New Schedule (24/7)
```json
"schedule": "* 0-23 * * *"
```
- Every minute
- 24 hours a day
- 7 days a week
- ~1440 calls/day × 2 credits = 2880 credits/day ⚠️ Exceeds 800 limit

**Note:** The new schedule exceeds the free tier. You may need to:
1. Upgrade your Twelve Data plan
2. Or revert to market hours only
3. Or use a different schedule

---

## Recommended Cron Schedule

For free tier (800 credits/day):

### Option A: Market Hours Only (Conservative)
```json
"schedule": "*/2 8-18 * * 1-5"
```
- 660 credits/day ✅
- Updates every 10 minutes during market hours
- Stale data outside market hours

### Option B: Extended Hours (Balanced)
```json
"schedule": "*/5 * * * *"
```
- Every 5 minutes, 24/7
- 288 calls/day × 2 credits = 576 credits/day ✅
- Full cycle in 25 minutes
- Fresh data always

### Option C: Frequent Updates (Requires Paid Plan)
```json
"schedule": "* * * * *"
```
- Every minute, 24/7
- 1440 calls/day × 2 credits = 2880 credits/day ⚠️
- Full cycle in 5 minutes
- Requires paid Twelve Data plan

---

## API Credit Usage

| Schedule | Calls/Day | Credits/Day | Free Tier? |
|----------|-----------|-------------|------------|
| Every 2 min (market hours) | 330 | 660 | ✅ Yes |
| Every 5 min (24/7) | 288 | 576 | ✅ Yes |
| Every 2 min (24/7) | 720 | 1440 | ❌ No |
| Every 1 min (24/7) | 1440 | 2880 | ❌ No |

**Free tier limit:** 800 credits/day

---

## Troubleshooting

### "Only one pair showing"

**Cause:** Cache is empty or stale

**Solution:** Run the init endpoint (Solution 1)

### "Data is X hours old"

**Cause:** Cron job not running or outside market hours

**Solutions:**
1. Check if dev server is running
2. Check if it's within market hours (if using market hours schedule)
3. Run init endpoint to refresh immediately
4. Change cron schedule to 24/7

### "Unauthorized" error when calling init

**Cause:** Wrong or missing admin secret

**Solution:** Check `.env.local` for `ADMIN_SECRET` and use the exact value

### "Rate limit exceeded"

**Cause:** Too many API calls to Twelve Data

**Solutions:**
1. Wait 1 minute for rate limit to reset
2. Use a less frequent cron schedule
3. Upgrade Twelve Data plan

---

## Production Deployment

When deploying to Vercel:

1. **Set environment variables:**
   - `TWELVE_DATA_API_KEY`
   - `ADMIN_SECRET`
   - `CRON_SECRET`

2. **Choose cron schedule:**
   - Use market hours schedule for free tier
   - Or upgrade Twelve Data plan for 24/7 updates

3. **Initialize cache:**
   - Call `/api/forex/init` once after deployment
   - Or wait 5 minutes for rotating updates

4. **Monitor usage:**
   - Check Twelve Data dashboard for credit usage
   - Adjust cron schedule if needed

---

## Summary

**Quick fix:**
1. Run `/api/forex/init` with admin secret
2. Wait 1-2 minutes
3. All 5 pairs will appear

**Long-term:**
1. Choose appropriate cron schedule for your plan
2. Monitor API credit usage
3. Upgrade plan if needed for 24/7 updates

**Current status:**
- ✅ Rotating system working
- ✅ Init endpoint created
- ⚠️ Cron schedule set to 24/7 (exceeds free tier)
- 💡 Consider changing to market hours or upgrading plan
