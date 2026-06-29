API_VERSION = "0.2.0"


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def json_content(schema):
    return {"application/json": {"schema": schema}}


def json_request(schema, required=True):
    return {"required": required, "content": json_content(schema)}


def response(description, schema=None):
    payload = {"description": description}
    if schema:
        payload["content"] = json_content(schema)
    return payload


AUTH_SECURITY = [{"bearerAuth": []}, {"cookieAuth": []}]


def build_openapi_spec():
    return {
        "openapi": "3.1.1",
        "info": {
            "title": "Career Tracker API",
            "version": API_VERSION,
            "summary": "Internship and new-grad application tracking API",
            "description": (
                "Public job search, account authentication, BCNF-normalized workspace persistence, "
                "leaderboard data, and private document storage. Protected operations accept either "
                "an `Authorization: Bearer <token>` header or the secure `ct_session` cookie."
            ),
        },
        "servers": [{"url": "/", "description": "Current Career Tracker deployment"}],
        "security": [],
        "tags": [
            {"name": "System", "description": "Service and database status"},
            {"name": "Jobs", "description": "Live public internship and new-grad listings"},
            {"name": "Authentication", "description": "Account and session management"},
            {"name": "Profile", "description": "Candidate profile"},
            {"name": "Workspace", "description": "Jobs, tasks, contacts, documents, goals, and notifications"},
            {"name": "Leaderboard", "description": "Application activity rankings"},
            {"name": "Documents", "description": "Private S3-compatible file storage"},
        ],
        "paths": {
            "/api/health": {
                "get": {
                    "tags": ["System"],
                    "summary": "Check service and database health",
                    "operationId": "getHealth",
                    "responses": {
                        "200": response("Service health", ref("HealthResponse")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/jobs": {
                "get": {
                    "tags": ["Jobs"],
                    "summary": "Search live early-career roles",
                    "operationId": "searchJobs",
                    "parameters": [
                        {
                            "name": "query",
                            "in": "query",
                            "schema": {"type": "string", "maxLength": 120},
                            "description": "Text matched against company, role, location, source, and description.",
                        },
                        {
                            "name": "season",
                            "in": "query",
                            "schema": {
                                "type": "string",
                                "enum": ["all", "fall2026", "2027", "internship", "newgrad"],
                                "default": "all",
                            },
                        },
                        {
                            "name": "remote",
                            "in": "query",
                            "schema": {
                                "type": "string",
                                "enum": ["all", "remote", "hybrid", "on-site"],
                                "default": "all",
                            },
                        },
                        {
                            "name": "refresh",
                            "in": "query",
                            "schema": {"type": "boolean", "default": False},
                            "description": "Refresh all public sources instead of using the ten-minute cache.",
                        },
                        {
                            "name": "limit",
                            "in": "query",
                            "schema": {"type": "integer", "minimum": 1, "maximum": 3000, "default": 240},
                        },
                    ],
                    "responses": {
                        "200": response("Live job feed", ref("JobFeedResponse")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/jobs/link-status": {
                "get": {
                    "tags": ["Jobs"],
                    "summary": "Check whether an external apply link is still reachable",
                    "operationId": "checkJobLinkStatus",
                    "parameters": [
                        {
                            "name": "url",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string", "format": "uri", "maxLength": 2048},
                            "description": "External ATS posting URL to verify before opening.",
                        }
                    ],
                    "responses": {
                        "200": response("Apply link status", ref("JobLinkStatus")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/auth/register": {
                "post": {
                    "tags": ["Authentication"],
                    "summary": "Create an account",
                    "operationId": "register",
                    "requestBody": json_request(ref("RegisterRequest")),
                    "responses": {
                        "201": response("Account created", ref("AuthResponse")),
                        "400": response("Invalid account data", ref("Error")),
                        "409": response("Email already registered", ref("Error")),
                        "415": response("Expected JSON", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/auth/login": {
                "post": {
                    "tags": ["Authentication"],
                    "summary": "Sign in with email and password",
                    "operationId": "login",
                    "requestBody": json_request(ref("LoginRequest")),
                    "responses": {
                        "200": response("Authenticated session", ref("AuthResponse")),
                        "400": response("Missing credentials", ref("Error")),
                        "401": response("Incorrect credentials", ref("Error")),
                        "415": response("Expected JSON", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/auth/google": {
                "post": {
                    "tags": ["Authentication"],
                    "summary": "Sign in with a Google Identity credential",
                    "operationId": "googleLogin",
                    "requestBody": json_request(ref("GoogleLoginRequest")),
                    "responses": {
                        "200": response("Authenticated session", ref("AuthResponse")),
                        "400": response("Missing credential", ref("Error")),
                        "401": response("Credential verification failed", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/auth/google/redirect": {
                "get": {
                    "tags": ["Authentication"],
                    "summary": "Receive the Google Identity query callback",
                    "operationId": "googleRedirectGet",
                    "description": "Browser callback used by Google Identity Services. Successful requests redirect to `/auth/complete`.",
                    "parameters": [
                        {
                            "name": "credential",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string"},
                        },
                        {
                            "name": "g_csrf_token",
                            "in": "query",
                            "schema": {"type": "string"},
                        },
                    ],
                    "responses": {
                        "303": {"description": "Redirect to auth completion or an authentication error"},
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                },
                "post": {
                    "tags": ["Authentication"],
                    "summary": "Receive the Google Identity form callback",
                    "operationId": "googleRedirect",
                    "description": "Browser callback used by Google Identity Services. Successful requests redirect to `/auth/complete`.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/x-www-form-urlencoded": {
                                "schema": ref("GoogleRedirectRequest")
                            }
                        },
                    },
                    "responses": {
                        "303": {"description": "Redirect to auth completion or an authentication error"},
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/auth/logout": {
                "post": {
                    "tags": ["Authentication"],
                    "summary": "Delete the current session",
                    "operationId": "logout",
                    "security": AUTH_SECURITY,
                    "responses": {
                        "200": response("Session cleared", ref("OkResponse")),
                        "403": response("Cross-site request rejected", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/me": {
                "get": {
                    "tags": ["Authentication"],
                    "summary": "Load the current user and workspace",
                    "operationId": "getCurrentUser",
                    "security": AUTH_SECURITY,
                    "responses": {
                        "200": response("Current user and workspace", ref("AuthResponse")),
                        "401": response("Not authenticated", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/profile": {
                "patch": {
                    "tags": ["Profile"],
                    "summary": "Update the current candidate profile",
                    "operationId": "updateProfile",
                    "security": AUTH_SECURITY,
                    "requestBody": json_request(ref("ProfileUpdateRequest")),
                    "responses": {
                        "200": response("Updated profile", ref("ProfileResponse")),
                        "400": response("Invalid JSON body", ref("Error")),
                        "401": response("Not authenticated", ref("Error")),
                        "403": response("Cross-site request rejected", ref("Error")),
                        "415": response("Expected JSON", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/workspace": {
                "get": {
                    "tags": ["Workspace"],
                    "summary": "Load the normalized workspace",
                    "operationId": "getWorkspace",
                    "security": AUTH_SECURITY,
                    "responses": {
                        "200": response("Workspace", ref("WorkspaceResponse")),
                        "401": response("Not authenticated", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                },
                "put": {
                    "tags": ["Workspace"],
                    "summary": "Replace the normalized workspace transactionally",
                    "operationId": "replaceWorkspace",
                    "security": AUTH_SECURITY,
                    "requestBody": json_request(ref("WorkspaceRequest")),
                    "responses": {
                        "200": response("Saved workspace", ref("WorkspaceResponse")),
                        "400": response("Invalid JSON body", ref("Error")),
                        "401": response("Not authenticated", ref("Error")),
                        "403": response("Cross-site request rejected", ref("Error")),
                        "415": response("Expected JSON", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                },
            },
            "/api/leaderboard": {
                "get": {
                    "tags": ["Leaderboard"],
                    "summary": "Rank candidates by applications sent",
                    "operationId": "getLeaderboard",
                    "security": AUTH_SECURITY,
                    "parameters": [
                        {
                            "name": "limit",
                            "in": "query",
                            "schema": {"type": "integer", "minimum": 5, "maximum": 100, "default": 50},
                        }
                    ],
                    "responses": {
                        "200": response("Leaderboard", ref("LeaderboardResponse")),
                        "401": response("Not authenticated", ref("Error")),
                        "429": response("Rate limit exceeded", ref("Error")),
                    },
                }
            },
            "/api/documents/upload": {
                "post": {
                    "tags": ["Documents"],
                    "summary": "Upload a private application document",
                    "operationId": "uploadDocument",
                    "security": AUTH_SECURITY,
                    "requestBody": {
                        "required": True,
                        "content": {
                            "multipart/form-data": {
                                "schema": {
                                    "type": "object",
                                    "required": ["file"],
                                    "properties": {
                                        "file": {
                                            "type": "string",
                                            "format": "binary",
                                            "description": "PDF, Word, image, text, CSV, Markdown, or JSON up to 10 MB.",
                                        }
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "201": response("Stored file metadata", ref("DocumentUploadResponse")),
                        "400": response("Missing or empty file", ref("Error")),
                        "401": response("Not authenticated", ref("Error")),
                        "403": response("Cross-site request rejected", ref("Error")),
                        "413": response("File too large", ref("Error")),
                        "415": response("Unsupported file type", ref("Error")),
                        "502": response("Storage upload failed", ref("Error")),
                        "503": response("Storage is not configured", ref("Error")),
                    },
                }
            },
            "/api/documents/file": {
                "get": {
                    "tags": ["Documents"],
                    "summary": "Preview or download a private document",
                    "operationId": "getDocumentFile",
                    "security": AUTH_SECURITY,
                    "parameters": [
                        {
                            "name": "key",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string", "maxLength": 512},
                        },
                        {
                            "name": "download",
                            "in": "query",
                            "schema": {"type": "boolean", "default": False},
                            "description": "Use attachment disposition when true.",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "Stored document bytes",
                            "content": {
                                "application/pdf": {"schema": {"type": "string", "format": "binary"}},
                                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}},
                            },
                        },
                        "401": response("Not authenticated", ref("Error")),
                        "404": response("Invalid key or missing file", ref("Error")),
                        "503": response("Storage is not configured", ref("Error")),
                    },
                }
            },
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "opaque session token",
                    "description": "Token returned by a successful login or registration.",
                },
                "cookieAuth": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "ct_session",
                    "description": "Secure HttpOnly session cookie set after authentication.",
                },
            },
            "schemas": schemas(),
        },
    }


def schemas():
    string = {"type": "string"}
    return {
        "Error": {
            "type": "object",
            "required": ["error"],
            "properties": {"error": {"type": "string"}},
        },
        "OkResponse": {
            "type": "object",
            "required": ["ok"],
            "properties": {"ok": {"type": "boolean", "const": True}},
        },
        "DatabaseHealth": {
            "type": "object",
            "required": ["configured", "ok", "schemaVersion", "normalForm"],
            "properties": {
                "configured": {"type": "boolean"},
                "ok": {"type": "boolean"},
                "schemaVersion": {"type": "integer", "example": 2},
                "normalForm": {"type": "string", "example": "BCNF"},
                "error": {"type": "string"},
            },
        },
        "HealthResponse": {
            "type": "object",
            "required": ["ok", "service", "database"],
            "properties": {
                "ok": {"type": "boolean"},
                "service": {"type": "string", "example": "career-tracker-dashboard"},
                "database": ref("DatabaseHealth"),
            },
        },
        "Profile": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "maxLength": 80},
                "program": {"type": "string", "maxLength": 80},
                "graduation": {"type": "string", "maxLength": 80},
                "visa": {"type": "string", "maxLength": 80},
                "avatar": {"type": "string", "maxLength": 2048},
            },
        },
        "User": {
            "type": "object",
            "required": ["id", "email", "profile", "createdAt", "updatedAt"],
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "email": {"type": "string", "format": "email"},
                "profile": ref("Profile"),
                "createdAt": string,
                "updatedAt": string,
            },
        },
        "RegisterRequest": {
            "type": "object",
            "required": ["email", "password"],
            "properties": {
                "email": {"type": "string", "format": "email"},
                "password": {"type": "string", "format": "password", "minLength": 8},
                "name": {"type": "string", "maxLength": 80},
                "avatar": {"type": "string", "maxLength": 2048},
                "profile": ref("Profile"),
            },
        },
        "LoginRequest": {
            "type": "object",
            "required": ["email", "password"],
            "properties": {
                "email": {"type": "string", "format": "email"},
                "password": {"type": "string", "format": "password"},
            },
        },
        "GoogleLoginRequest": {
            "type": "object",
            "required": ["credential"],
            "properties": {"credential": {"type": "string", "description": "Google Identity Services ID token."}},
        },
        "GoogleRedirectRequest": {
            "type": "object",
            "required": ["credential"],
            "properties": {
                "credential": {"type": "string"},
                "g_csrf_token": {"type": "string"},
            },
        },
        "AuthResponse": {
            "type": "object",
            "required": ["user", "workspace"],
            "properties": {
                "user": ref("User"),
                "token": {"type": "string", "writeOnly": True},
                "workspace": ref("Workspace"),
            },
        },
        "ProfileUpdateRequest": {
            "oneOf": [
                ref("Profile"),
                {
                    "type": "object",
                    "required": ["profile"],
                    "properties": {"profile": ref("Profile")},
                },
            ]
        },
        "ProfileResponse": {
            "type": "object",
            "required": ["user"],
            "properties": {"user": ref("User")},
        },
        "JobFeedItem": {
            "type": "object",
            "required": ["id", "company", "role", "location", "season", "mode", "sourceUrl"],
            "properties": {
                "id": string,
                "company": string,
                "role": string,
                "location": string,
                "season": string,
                "mode": {"type": "string", "enum": ["Remote", "Hybrid", "On-site"]},
                "source": string,
                "sourceUrl": {"type": "string", "format": "uri"},
                "posted": string,
                "tags": {"type": "array", "items": string},
                "summary": string,
                "description": string,
                "match": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "additionalProperties": True,
        },
        "JobSource": {
            "type": "object",
            "required": ["name", "url"],
            "properties": {"name": string, "url": {"type": "string", "format": "uri"}},
        },
        "SourceStatus": {
            "type": "object",
            "required": ["index", "ok", "count", "error"],
            "properties": {
                "index": {"type": "integer"},
                "ok": {"type": "boolean"},
                "count": {"type": "integer"},
                "error": string,
            },
        },
        "JobFeedResponse": {
            "type": "object",
            "required": ["fetchedAt", "total", "filteredTotal", "count", "jobs", "sources", "sourceStatus"],
            "properties": {
                "fetchedAt": {"type": "string", "format": "date-time"},
                "total": {"type": "integer"},
                "filteredTotal": {"type": "integer"},
                "count": {"type": "integer"},
                "jobs": {"type": "array", "items": ref("JobFeedItem")},
                "sources": {"type": "array", "items": ref("JobSource")},
                "sourceStatus": {"type": "array", "items": ref("SourceStatus")},
            },
        },
        "JobLinkStatus": {
            "type": "object",
            "required": ["ok", "status", "checked", "message", "url"],
            "properties": {
                "ok": {"type": "boolean"},
                "status": {"type": "string", "enum": ["available", "unavailable", "unchecked", "unknown", "invalid"]},
                "checked": {"type": "boolean"},
                "message": string,
                "url": {"type": "string"},
                "httpStatus": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        "OAAttempt": {
            "type": "object",
            "required": ["id", "completedAt", "durationMinutes", "questionTypes", "result", "reflection"],
            "properties": {
                "id": string,
                "completedAt": string,
                "durationMinutes": {"type": "integer", "minimum": 0, "maximum": 1440},
                "questionTypes": {"type": "array", "items": string},
                "result": {"type": "string", "enum": ["Scheduled", "Completed", "Passed", "Rejected"]},
                "reflection": string,
            },
        },
        "JobActivity": {
            "type": "object",
            "required": ["id", "type", "at"],
            "properties": {
                "id": string,
                "type": {"type": "string", "enum": ["saved", "applied"]},
                "at": string,
            },
        },
        "TrackedJob": {
            "allOf": [
                ref("JobFeedItem"),
                {
                    "type": "object",
                    "required": ["stage", "priority", "oaAttempts", "activity"],
                    "properties": {
                        "deadline": {"type": "string", "format": "date"},
                        "sponsorship": string,
                        "stage": {"type": "string", "enum": ["saved", "applied", "oa", "interview", "offer"]},
                        "priority": {"type": "boolean"},
                        "contact": string,
                        "contactRole": string,
                        "contactEmail": {"type": "string"},
                        "requirements": string,
                        "notes": string,
                        "nextStep": string,
                        "oaAttempts": {"type": "array", "items": ref("OAAttempt")},
                        "activity": {"type": "array", "items": ref("JobActivity")},
                    },
                },
            ]
        },
        "Task": {
            "type": "object",
            "required": ["id", "title", "done", "priority"],
            "properties": {
                "id": string,
                "title": string,
                "subtitle": string,
                "done": {"type": "boolean"},
                "due": {"type": "string", "format": "date"},
                "priority": {"type": "string", "enum": ["High", "Medium", "Low"]},
                "sourceJobId": string,
                "taskType": string,
            },
        },
        "Contact": {
            "type": "object",
            "required": ["id", "name"],
            "properties": {
                "id": string,
                "name": string,
                "company": string,
                "role": string,
                "email": {"type": "string"},
                "next": string,
                "source": string,
                "sourceJobId": string,
            },
        },
        "Document": {
            "type": "object",
            "required": ["id", "name", "type", "status"],
            "properties": {
                "id": string,
                "name": string,
                "type": string,
                "status": string,
                "target": string,
                "sourceJobId": string,
                "url": {"type": "string"},
                "version": string,
                "owner": string,
                "notes": string,
                "fileName": string,
                "fileType": string,
                "fileSize": {"type": "integer"},
                "fileData": string,
                "fileKey": string,
                "fileUrl": string,
                "storage": string,
                "updated": string,
            },
        },
        "Goal": {
            "type": "object",
            "required": ["target", "deadline", "label"],
            "properties": {
                "target": {"type": "integer", "minimum": 0, "maximum": 5000},
                "deadline": {"type": "string", "format": "date"},
                "label": string,
            },
        },
        "NotificationState": {
            "type": "object",
            "required": ["readIds", "dismissedIds", "browserAlerts"],
            "properties": {
                "readIds": {"type": "array", "items": string},
                "dismissedIds": {"type": "array", "items": string},
                "browserAlerts": {"type": "boolean"},
            },
        },
        "Workspace": {
            "type": "object",
            "required": ["jobs", "tasks", "contacts", "documents", "notificationState"],
            "properties": {
                "jobs": {"type": "array", "maxItems": 500, "items": ref("TrackedJob")},
                "tasks": {"type": "array", "maxItems": 500, "items": ref("Task")},
                "contacts": {"type": "array", "maxItems": 500, "items": ref("Contact")},
                "documents": {"type": "array", "maxItems": 200, "items": ref("Document")},
                "goal": {"oneOf": [ref("Goal"), {"type": "null"}]},
                "notificationState": ref("NotificationState"),
            },
        },
        "WorkspaceRequest": {
            "oneOf": [
                ref("Workspace"),
                {
                    "type": "object",
                    "required": ["workspace"],
                    "properties": {"workspace": ref("Workspace")},
                },
            ]
        },
        "WorkspaceResponse": {
            "type": "object",
            "required": ["workspace"],
            "properties": {"workspace": ref("Workspace")},
        },
        "LeaderboardEntry": {
            "type": "object",
            "required": ["rank", "name", "applied", "tracked", "offers", "isCurrentUser"],
            "properties": {
                "rank": {"type": "integer"},
                "name": string,
                "avatar": string,
                "program": string,
                "graduation": string,
                "applied": {"type": "integer"},
                "tracked": {"type": "integer"},
                "saved": {"type": "integer"},
                "oa": {"type": "integer"},
                "interviews": {"type": "integer"},
                "offers": {"type": "integer"},
                "priority": {"type": "integer"},
                "conversionRate": {"type": "integer"},
                "offerRate": {"type": "integer"},
                "goalTarget": {"type": "integer"},
                "goalProgress": {"type": "integer"},
                "workspaceUpdatedAt": string,
                "isCurrentUser": {"type": "boolean"},
            },
        },
        "LeaderboardResponse": {
            "type": "object",
            "required": ["generatedAt", "metric", "totalUsers", "activeUsers", "entries"],
            "properties": {
                "generatedAt": {"type": "string", "format": "date-time"},
                "metric": {"type": "string", "const": "applied"},
                "totalUsers": {"type": "integer"},
                "activeUsers": {"type": "integer"},
                "topApplied": {"type": "integer"},
                "peerAverage": {"type": "integer"},
                "currentUser": {"oneOf": [ref("LeaderboardEntry"), {"type": "null"}]},
                "entries": {"type": "array", "items": ref("LeaderboardEntry")},
            },
        },
        "DocumentUploadResponse": {
            "type": "object",
            "required": ["fileName", "fileType", "fileSize", "fileKey", "fileUrl", "storage"],
            "properties": {
                "fileName": string,
                "fileType": string,
                "fileSize": {"type": "integer"},
                "fileKey": string,
                "fileUrl": string,
                "storage": {"type": "string", "const": "s3"},
            },
        },
    }
