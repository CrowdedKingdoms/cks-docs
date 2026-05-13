# AWS SES Email Notification Setup Guide

This guide explains how to configure AWS SES to send bounce, complaint, and delivery notifications to your API.

## Prerequisites

1. AWS account with SES configured and verified
2. API deployed and accessible via HTTPS
3. AWS credentials configured (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`)

## Environment Variables

Add these to your `.env` file:

```bash
# Required
EMAIL_FROM=your-email@domain.com
AWS_REGION=us-east-2

# Optional
API_BASE_URL=https://your-api-domain.com
AUTO_CONFIRM_SNS_SUBSCRIPTIONS=true
DISABLE_AWS_VERIFICATION=false  # Set to true only in development
NODE_ENV=production
```

## Step 1: Create SNS Topic

1. Go to AWS SNS Console
2. Create a new topic:
   - Name: `ses-email-notifications`
   - Type: Standard
   - Display name: SES Email Notifications

3. Note the Topic ARN (e.g., `arn:aws:sns:us-east-2:123456789012:ses-email-notifications`)

## Step 2: Subscribe Your API Endpoint

1. In SNS, create a subscription:
   - Protocol: HTTPS
   - Endpoint: `https://your-api-domain.com/email-webhooks/sns`
   - Enable raw message delivery: NO

2. AWS will send a subscription confirmation to your endpoint
3. Your API will automatically confirm if `AUTO_CONFIRM_SNS_SUBSCRIPTIONS=true`

## Step 3: Configure SES Event Publishing

### Option A: Configuration Set (Recommended)

1. In AWS SES Console, go to Configuration sets
2. Create a new configuration set:
   - Name: `email-notifications`

3. Add event destination:
   - Event types: Select all (Bounce, Complaint, Delivery, Send, Reject, Delivery Delay)
   - Destination type: Amazon SNS
   - SNS topic: Select your topic from Step 1

4. Update your email sending code to use this configuration set:

```typescript
const command = new SendEmailCommand({
  Source: this.fromEmail,
  Destination: { ToAddresses: [to] },
  Message: { 
    Subject: { Data: subject },
    Body: { Html: { Data: html } }
  },
  ConfigurationSetName: 'email-notifications'  // Add this line
});
```

### Option B: Domain/Email Identity Level

1. Go to SES > Verified identities
2. Select your domain or email
3. Go to Notifications tab
4. Set SNS topic for:
   - Bounces
   - Complaints
   - Deliveries

## Step 4: Test Your Setup

### Test Bounce Handling
```bash
# Send to SES simulator address
curl -X POST https://your-api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "bounce@simulator.amazonses.com"}'
```

### Test Complaint Handling
```bash
curl -X POST https://your-api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "complaint@simulator.amazonses.com"}'
```

### Test Success Delivery
```bash
curl -X POST https://your-api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "success@simulator.amazonses.com"}'
```

## Step 5: Monitor Your Setup

Check your logs for:

```
[EmailController] Received SNS notification type: Notification
[EmailController] Processing SES notification: Bounce
[EmailService] Email user@example.com bounced: Permanent/General
```

## Database Schema

The system tracks email status in the `email_status` table:

```sql
-- Current status of each email address
SELECT * FROM email_status;

-- View bounced emails
SELECT * FROM email_status WHERE status = 'bounced';

-- View complained emails  
SELECT * FROM email_status WHERE status = 'complained';
```

## Security Considerations

1. **SNS Signature Verification**: The API verifies all SNS messages are from AWS
2. **HTTPS Only**: SNS requires HTTPS endpoints
3. **Certificate Validation**: The API validates AWS signing certificates
4. **Automatic Blacklisting**: Bounced/complained emails are automatically blocked

## Troubleshooting

### Subscription Not Confirming
- Check `AUTO_CONFIRM_SNS_SUBSCRIPTIONS=true` in environment
- Check API logs for confirmation attempts
- Manually confirm via AWS Console if needed

### Notifications Not Received
- Verify SNS topic subscription is "Confirmed"
- Check SES Configuration Set is applied to emails
- Review CloudWatch logs for SNS delivery attempts

### Signature Verification Failures
- Ensure system time is synchronized (NTP)
- Check `NODE_ENV` and `DISABLE_AWS_VERIFICATION` settings
- Verify certificates can be fetched from AWS

## Email Status Types

- **valid**: Email successfully delivered
- **bounced**: Email permanently failed (hard bounce)
- **complained**: Recipient marked as spam

## Best Practices

1. Always use Configuration Sets for consistent tracking
2. Monitor bounce rates (AWS requires < 5%)
3. Monitor complaint rates (AWS requires < 0.1%)
4. Implement retry logic for transient failures
5. Keep email lists clean by removing bounced/complained addresses
6. Set up CloudWatch alarms for high bounce/complaint rates

## Additional Resources

- [AWS SES Event Publishing](https://docs.aws.amazon.com/ses/latest/dg/event-publishing.html)
- [SNS Message Signature Verification](https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html)
- [SES Simulator Addresses](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html) 