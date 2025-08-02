# Environment Variables Configuration Guide

## Required Environment Variables for Production Deployment

### 🔧 Core Configuration

```bash
# Server
NODE_ENV=production
PORT=10000  # Render default port
```

### 🗄️ Database Configuration

```bash
# PostgreSQL (Get from Render Dashboard after creating database)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
```

### 🔄 Redis Configuration

```bash
# Redis (Get from Render Dashboard after creating Redis instance)
REDIS_URL=redis://default:password@hostname:6379
```

### 🤖 N8N Integration

```bash
# N8N Webhook URL (After deploying N8N to Render)
N8N_WEBHOOK_URL=https://your-n8n-instance.onrender.com
N8N_API_KEY=your_n8n_api_key_here
```

### 🧠 OpenAI Configuration

```bash
# OpenAI API Key (From OpenAI Dashboard)
OPENAI_API_KEY=sk-...your_openai_api_key_here
```

### 📅 Monday.com Integration

```bash
# From Monday.com Developer Portal
MONDAY_CLIENT_ID=your_monday_client_id
MONDAY_CLIENT_SECRET=your_monday_client_secret
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_SIGNING_SECRET=your_webhook_signing_secret
MONDAY_REDIRECT_URI=https://your-app.onrender.com/auth/callback
```

### 🔐 Security

```bash
# JWT Configuration
JWT_SECRET=generate_a_strong_random_string_here
JWT_EXPIRES_IN=24h
```

### 📧 Email Configuration (Optional)

```bash
# SendGrid Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
```

### 🌐 Frontend URL

```bash
# Your frontend deployment URL
FRONTEND_URL=https://your-frontend.onrender.com
```

## How to Set Environment Variables in Render

1. **Navigate to your service** in Render Dashboard
2. Click on **Environment** tab
3. Click **Add Environment Variable**
4. Add each variable one by one
5. Click **Save Changes**
6. Service will automatically redeploy

## Getting Required Values

### PostgreSQL Database URL
1. Create a PostgreSQL database in Render
2. Copy the **Internal Database URL** from the database dashboard
3. Use this as your `DATABASE_URL`

### Redis URL
1. Create a Redis instance in Render
2. Copy the connection string from the Redis dashboard
3. Use this as your `REDIS_URL`

### Monday.com Credentials
1. Go to https://developers.monday.com
2. Create a new app
3. Copy the Client ID, Client Secret, and generate an API token
4. Set up webhook and copy the signing secret

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and save it securely

## Security Best Practices

1. **Never commit .env files** to version control
2. **Use strong, unique values** for JWT_SECRET
3. **Rotate API keys** regularly
4. **Use Render's encryption** for sensitive values
5. **Limit API key permissions** where possible

## Testing Your Configuration

After setting all environment variables:

1. Check the **Logs** tab in Render
2. Look for successful connection messages:
   - "Database connected successfully"
   - "Redis client connected"
   - "N8N webhook configured"
3. Test the health endpoint: `https://your-app.onrender.com/health`

## Troubleshooting

### Database Connection Failed
- Verify DATABASE_URL format
- Check if database is running
- Ensure SSL is properly configured

### Redis Connection Failed
- Verify REDIS_URL format
- Check Redis instance status
- Ensure proper authentication

### Monday.com Webhook Failed
- Verify signing secret matches
- Check webhook URL in Monday app settings
- Ensure proper HTTPS configuration

## Emergency Contacts

- Render Support: https://render.com/support
- Monday.com Support: support@monday.com
- Your DevOps Contact: [Add your contact here]