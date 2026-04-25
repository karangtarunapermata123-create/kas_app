# Panduan Deploy ke Vercel

## 🚀 Langkah-langkah Deploy

### 1. **Persiapan Project**
```bash
# Install dependencies
npm install

# Build untuk web
npm run build

# Test local (opsional)
npx serve dist
```

### 2. **Setup Vercel**

#### Via Vercel CLI:
```bash
# Install Vercel CLI
npm i -g vercel

# Login ke Vercel
vercel login

# Deploy
vercel --prod
```

#### Via Vercel Dashboard:
1. Login ke [vercel.com](https://vercel.com)
2. Import project dari GitHub
3. Set environment variables (lihat bagian Environment Variables)
4. Deploy

### 3. **Environment Variables di Vercel**

Tambahkan environment variables berikut di Vercel Dashboard:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Cara menambahkan:**
1. Buka project di Vercel Dashboard
2. Go to Settings > Environment Variables
3. Tambahkan kedua variable di atas
4. Redeploy project

### 4. **Troubleshooting**

#### Error 404 NOT_FOUND:
- Pastikan `vercel.json` sudah benar
- Pastikan build berhasil (`npm run build`)
- Check environment variables sudah diset

#### Build Error:
- Pastikan semua dependencies terinstall
- Check tidak ada error di kode
- Pastikan Expo CLI terbaru: `npm i -g @expo/cli`

#### Environment Variables tidak terbaca:
- Pastikan prefix `EXPO_PUBLIC_` untuk client-side variables
- Redeploy setelah menambah environment variables
- Check di browser console apakah variables terbaca

### 5. **Custom Domain (Opsional)**

Jika ingin menggunakan domain sendiri:
1. Buka project di Vercel Dashboard
2. Go to Settings > Domains
3. Tambahkan domain
4. Update DNS records sesuai instruksi Vercel

### 6. **Auto Deploy dari Git**

Untuk auto deploy saat push ke GitHub:
1. Connect repository di Vercel Dashboard
2. Set branch untuk production (biasanya `main`)
3. Setiap push ke branch tersebut akan auto deploy

## 📝 **Checklist Deploy**

- [ ] `npm run build` berhasil tanpa error
- [ ] Environment variables sudah diset di Vercel
- [ ] `vercel.json` sudah benar
- [ ] Test di local dengan `npx serve dist`
- [ ] Deploy ke Vercel
- [ ] Test semua fitur di production
- [ ] Setup custom domain (jika perlu)

## 🔗 **Links Berguna**

- [Vercel Docs](https://vercel.com/docs)
- [Expo Web Docs](https://docs.expo.dev/workflow/web/)
- [Supabase Docs](https://supabase.com/docs)