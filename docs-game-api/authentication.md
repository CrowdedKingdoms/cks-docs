# User Authentication Module

This module provides a complete user authentication system for the NestJS application with TypeORM and PostgreSQL integration. It includes email verification, password reset, and AWS SES integration for email delivery and bounce/complaint handling.

## Features

- User registration with email verification
- Password reset functionality
- AWS SES integration for email delivery
- Handling of email bounces and complaints via AWS SNS webhooks
- GraphQL and REST API endpoints

## Database Schema

The module uses the following database tables:

- `users` - Stores user information including email and hashed password
- `game_tokens` - Stores tokens
- `confirmation_tokens` - Stores tokens for email verification
- `password_reset_tokens` - Stores tokens for password reset
- `email_status` - Tracks email delivery status (bounces, complaints)

### Database Initialization

We provide scripts to set up and migrate the database:

1. Copy `example.env` to `.env` and configure your database connection
2. Run the initialization script:

```bash
cd database
./initialize-db.sh
```

This will:
- Create the necessary tables if they don't exist
- Track schema versions in `database_version_control` table
- Apply any new migrations in the `migrations` directory

## Configuration

Configuration is managed through environment variables. Copy `example.env` to `.env` and configure:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=crowdrocks

# Frontend URL for email links
FRONTEND_URL=http://localhost:3001

# Email Configuration (AWS SES)
EMAIL_FROM=noreply@yourdomain.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# AWS SNS Notification Configuration
DISABLE_AWS_VERIFICATION=false
DISABLE_SIGNATURE_VERIFICATION=false
```

## API Endpoints

### GraphQL

The module provides the following GraphQL mutations:

- `login(loginUserInput: LoginUserInput)`: Authenticates a user and returns a token
- `register(registerUserInput: RegisterUserInput)`: Registers a new user and sends a verification email
- `confirmEmail(token: String)`: Confirms a user's email address using the token
- `requestPasswordReset(email: String)`: Sends a password reset email
- `resetPassword(resetPasswordInput: ResetPasswordInput)`: Resets a user's password
- `resendConfirmationEmail(email: String)`: Resends the confirmation email

And the following queries:

- `me`: Returns the currently authenticated user
- `user(id: Int)`: Returns a user by ID (requires authentication)

### REST API

The module also provides these REST endpoints:

- `POST /auth/login`: Login endpoint
- `POST /auth/register`: User registration
- `GET /auth/confirm/:token`: Email confirmation
- `POST /auth/password-reset-request`: Request password reset
- `POST /auth/password-reset`: Reset password
- `POST /auth/resend-confirmation`: Resend confirmation email
- `GET /auth/me`: Get the currently authenticated user

### AWS SES Webhook

- `POST /email-webhooks/sns`: Endpoint for receiving AWS SNS notifications for email bounces and complaints

## Usage

### Authentication Flow

1. User registers via the `register` mutation or REST endpoint
2. A confirmation email is sent to the user's email
3. User confirms their email by clicking the link in the email
4. User can now log in via the `login` mutation or REST endpoint
5. The login returns a token that should be included in subsequent authenticated requests

### Password Reset Flow

1. User requests a password reset via the `requestPasswordReset` mutation or REST endpoint
2. A password reset email is sent to the user's email
3. User clicks the link in the email and enters a new password
4. The new password is set via the `resetPassword` mutation or REST endpoint

## Security Considerations

### Password Storage

Passwords are never stored in plain text. They are hashed using bcrypt with a salt round of 10, which provides strong protection against brute force attacks.

### Token Security

- Email confirmation and password reset tokens are:
  - Randomly generated using crypto.randomBytes (32 bytes / 64 hex characters)
  - Associated with a specific user in the database
  - Given a 24-hour expiration
  - Single-use only (automatically removed after use)

### Email Security

- The system tracks email bounces and complaints to maintain email reputation
- Users with bounced or complained emails are prevented from registering
- AWS SES webhook notifications are verified using AWS's cryptographic signature

### Rate Limiting Considerations

For production deployment, consider implementing rate limiting on:
- Login attempts
- Registration attempts
- Password reset requests
- Confirmation email resend requests

This can be achieved using the `@nestjs/throttler` package.

### CORS and CSRF Protection

- CORS is configured to restrict cross-origin requests
- For production deployments, restrict the CORS_ORIGIN to your frontend domain
- Consider implementing CSRF protection for production environments

## Development

Start the development server:

```bash
./start-dev.sh
```

This script:
1. Copies `example.env` to `.env` if it doesn't exist
2. Installs dependencies if needed
3. Starts the application in development mode

## Testing

You can use the provided `auth-demo.http` file with a REST client like VS Code's REST Client extension to test the API endpoints. 