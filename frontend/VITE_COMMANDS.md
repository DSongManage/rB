# Vite Commands - Quick Reference

## Development

### Start dev server
```bash
npm run dev
```
- Opens: http://127.0.0.1:3000
- Hot reload: Instant (< 100ms)
- API proxy: Automatically proxies to Django backend

### Stop dev server
```bash
# Ctrl+C in terminal, or:
pkill -f "vite"
```

## Production

### Build for production
```bash
npm run build
```
- Output: `dist/` directory
- Time: ~2 seconds
- Includes TypeScript check

### Preview production build
```bash
npm run preview
```
- Opens: http://127.0.0.1:4173
- Tests the production bundle locally

## Testing

### Run tests (Vitest)
```bash
npm test
```
- Note: Tests need migration from Jest to Vitest

## Environment Variables

### Development (.env)
```env
VITE_WEB3AUTH_CLIENT_ID=your_client_id_here
```

### In code
```typescript
const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
```

## Django Backend

### Start Django server (separate terminal)
```bash
cd ../backend
source ../venv/bin/activate
python manage.py runserver
```
- Django runs on: http://127.0.0.1:8000
- Vite proxies API calls automatically

## Common Issues

### Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

### Build fails with TypeScript errors
```bash
# Temporarily disable strict checks in tsconfig.json
"noUnusedLocals": false,
"noUnusedParameters": false,
```

## VS Code Integration

### Recommended extensions
- ESLint
- Vite
- TypeScript Vue Plugin (Volar)

### Launch configuration (.vscode/launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome with Vite",
      "url": "http://127.0.0.1:3000",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

## Performance Tips

### Check bundle size
```bash
npm run build
# Look for chunk size warnings
```

### Analyze bundle
```bash
npm install -D rollup-plugin-visualizer
# Add to vite.config.ts:
import { visualizer } from 'rollup-plugin-visualizer';
plugins: [react(), visualizer()]
```

## Deployment

### Build for production
```bash
npm run build
# Deploy the dist/ folder
```

### Serve from Django
Update `backend/renaissBlock/settings.py`:
```python
TEMPLATES[0]['DIRS'] = [
    str(BASE_DIR / 'templates'),
    str(BASE_DIR.parent / 'frontend' / 'dist'),
]
```

## Rollback to CRA (not recommended)
```bash
mv package.json package.json.vite
mv package.json.cra.backup package.json
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm start
```

