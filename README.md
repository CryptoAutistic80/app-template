# Expo Base Template

This is a template repository for creating new Expo apps.

## How to use this template

### Option 1: GitHub Template
1. Click the "Use this template" button at the top of the repository page.
2. Create a new repository from this template.
3. Clone your new repository.

### Option 2: Clone directly
```bash
git clone https://github.com/CryptoAutistic80/app-template.git my-new-app
cd my-new-app
rm -rf .git
git init
```

## Post-Setup Configuration

After creating your new project, you **must** update the following files to match your new app's name:

1.  **`app.json`**:
    *   Change `name`, `slug`, and `scheme`.
    *   Update `ios.bundleIdentifier` and `android.package` if they exist.

2.  **`package.json`**:
    *   Change `name`.

3.  **Install dependencies**:
    ```bash
    npm install
    ```

## Running the App

```bash
npm run start
```
