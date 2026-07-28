# SELAP Screen Transition Diagram

```mermaid
flowchart TD
    Start([User opens SELAP]) --> Root["/"]
    Root -->|Auto redirect| Login["Login Screen<br/>/auth/login"]

    Login -->|Sign in successfully| Catalog["Property Catalog<br/>/properties"]
    Login -->|Create account| Register["Register Screen<br/>/auth/register"]
    Login -->|Forgot password| ForgotPassword["Forgot Password Screen<br/>/auth/forgot-password"]

    Register -->|Submit registration| VerifyEmail["Email Verification Screen<br/>/auth/verify-email"]
    VerifyEmail -->|Verify code successfully| Login
    VerifyEmail -->|Resend code| VerifyEmail

    ForgotPassword -->|Send reset code| ResetCode["Reset Code Step<br/>/auth/forgot-password"]
    ResetCode -->|Use another email| ForgotPassword
    ResetCode -->|Verify code successfully| ResetPassword["Reset Password Screen<br/>/auth/reset-password"]
    ResetPassword -->|Reset password successfully| Login
    NewPassword["New Password Alias<br/>/auth/new-password"] -->|Auto redirect| ResetPassword

    Catalog -->|Dashboard shortcut| Dashboard["Dashboard<br/>/dashboard"]
    Dashboard -->|Browse Catalog| Catalog
    Dashboard -->|Manage Properties| ManageProperties["Property Management<br/>/properties/manage"]

    Catalog -->|Customer navigation| Favorites["Favorites<br/>(planned)"]
    Catalog -->|Customer navigation| Notifications["Notifications<br/>(planned)"]

    Catalog -->|Admin: Add Property| ManageProperties
    Catalog -->|Sales Agent: Add Property| ManageProperties
    Catalog -->|Admin: Pending Agents| PendingAgents["Pending Agent Approval<br/>/admin/pending-agents"]
    Catalog -->|Sales Agent: Lead Inbox| LeadInbox["Lead Inbox<br/>(planned)"]
    Catalog -->|Admin: Staff Directory| StaffDirectory["Staff Directory<br/>(planned)"]

    ManageProperties -->|New Property| PropertyForm["Create Property Form"]
    ManageProperties -->|Edit property| PropertyForm
    ManageProperties -->|Delete property| ManageProperties
    PropertyForm -->|Create / Save changes| ManageProperties
    PropertyForm -->|Cancel| ManageProperties

    PendingAgents -->|Approve agent + assign area| PendingAgents
    PendingAgents -->|Reject agent| PendingAgents

    subgraph PublicAccess["Public / Guest Access"]
        Root
        Login
        Register
        VerifyEmail
        ForgotPassword
        ResetCode
        ResetPassword
        NewPassword
        Catalog
    end

    subgraph CustomerAccess["Customer Access"]
        Favorites
        Notifications
    end

    subgraph SalesAgentAccess["Sales Agent Access"]
        LeadInbox
        ManageProperties
    end

    subgraph AdminAccess["Admin Access"]
        PendingAgents
        StaffDirectory
    end
```

## Notes

- After a successful login, the current implementation redirects all roles to the Property Catalog screen.
- The navigation bar changes by role after reading the signed-in user's role from the access token and `/auth/me`.
- Favorites, Notifications, Lead Inbox, and Staff Directory are present as navigation targets but are not implemented as real routes yet.
- Property Management supports listing, searching, creating, editing, deleting, uploading images, and updating property status.
- Pending Agent Approval lets Admin users approve Sales Agent accounts after assigning an area, or reject pending accounts.
