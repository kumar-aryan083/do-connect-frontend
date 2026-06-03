# DoConnect Frontend

Static HTML/CSS/JS frontend for the DoConnect backend capstone project.

## How to run

1. Start all backend services first:
   - eureka-server
   - config-server
   - api-gateway
   - user-service
   - admin-service
   - question-service
   - answer-service
   - interaction-service
   - chat-service

2. Make sure API Gateway is running at:

```text
http://localhost:8080
```

3. Open this frontend folder in VS Code.

4. Use the Live Server extension, or open `index.html` directly.

Recommended:

```text
Right click index.html -> Open with Live Server
```

## Pages

```text
index.html  - login/register page
user.html   - user dashboard
admin.html  - admin dashboard
```

## Default API Base

```text
http://localhost:8080
```

You can change it in:

```text
js/api.js
```
