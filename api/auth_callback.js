import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const error_description = url.searchParams.get('error_description');

    // Si hay error, redirigir a página de error
    if (error) {
      return Response.redirect(
        `${url.origin}/error.html?message=${encodeURIComponent(error_description || error)}`
      );
    }

    // Si no hay code, algo salió mal
    if (!code) {
      return Response.redirect(
        `${url.origin}/error.html?message=Código de autenticación no válido`
      );
    }

    // Configurar Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Intercambiar el code por una sesión
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Error intercambiando código:', exchangeError);
      return Response.redirect(
        `${url.origin}/error.html?message=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Éxito - redirigir a la app
    const redirectUrl = process.env.REDIRECT_URL_SUCCESS || 'petadopt://auth/success';
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autenticación Exitosa - PetAdopt</title>
  <link rel="stylesheet" href="/styles/auth.css">
  <script>
    setTimeout(() => {
      window.location.href = '${redirectUrl}?access_token=${data.session?.access_token || ''}&refresh_token=${data.session?.refresh_token || ''}';
    }, 1000);
    
    setTimeout(() => {
      document.getElementById('fallback').style.display = 'block';
    }, 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>¡Autenticación Exitosa!</h1>
    <p>Redirigiendo a PetAdopt...</p>
    
    <div id="fallback" style="display: none;">
      <p>Si no se abre automáticamente:</p>
      <a href="${redirectUrl}" class="button">Abrir PetAdopt</a>
    </div>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error en auth-callback:', error);
    return Response.redirect(
      `${url.origin}/error.html?message=Error del servidor`
    );
  }
}