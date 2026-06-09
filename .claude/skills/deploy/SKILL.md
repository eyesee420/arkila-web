---
name: deploy
description: Build Arkila for production and deploy to the local nginx server on Windows. Run this after finishing a feature or fix.
disable-model-invocation: true
---

Deploy Arkila to the local nginx server.

## Steps

1. **Build the app**
   ```
   npm run build
   ```
   If the build fails (TypeScript errors), stop and report what failed.

2. **Copy nginx config**
   ```
   copy "C:\Users\icy\Desktop\test1\arkila-web\nginx.conf" "C:\nginx\conf\nginx.conf"
   ```

3. **Reload or start nginx**
   Check if nginx is running:
   ```
   tasklist /fi "imagename eq nginx.exe"
   ```
   - If running → `cd C:\nginx && nginx -s reload`
   - If not running → `cd C:\nginx && start nginx`

4. **Verify**
   Tell the user the app is live at **http://localhost** and note the build size from the Vite output.

## On build failure
Report the exact TypeScript or Vite error. Do not attempt to reload nginx with a broken build.
