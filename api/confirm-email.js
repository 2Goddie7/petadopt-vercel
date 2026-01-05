import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type') || 'signup';

    // Validar que existe el token
    if (!token) {
      return Response.redirect(`${url.origin}/error.html?message=Token no válido`);
    }

    // Configurar Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Verificar el token con Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type === 'recovery' ? 'recovery' : 'signup',
    });

    if (error) {
      console.error('Error verificando token:', error);
      return Response.redirect(
        `${url.origin}/error.html?message=${encodeURIComponent(error.message)}`
      );
    }

    // Si la verificación fue exitosa
    if (data?.user) {
      // Obtener URL de redirección desde env o usar default
      const redirectUrl = process.env.REDIRECT_URL_SUCCESS || 'petadopt://auth/success';
      
      // Crear respuesta HTML con redirección automática
      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Confirmado - PetAdopt</title>
  <link rel="stylesheet" href="/styles/auth.css">
  <script>
    // Intentar abrir la app
    setTimeout(() => {
      window.location.href = '${redirectUrl}';
    }, 2000);
    
    // Fallback: si no se abre la app, mostrar instrucciones
    setTimeout(() => {
      document.getElementById('fallback').style.display = 'block';
    }, 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>¡Email Confirmado!</h1>
    <p>Tu cuenta ha sido verificada exitosamente.</p>
    <p class="subtitle">Redirigiendo a la app...</p>
    
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
    }

    // Si llegamos aquí, algo salió mal
    return Response.redirect(
      `${url.origin}/error.html?message=No se pudo verificar el email`
    );

  } catch (error) {
    console.error('Error en confirm-email:', error);
    return Response.redirect(
      `${url.origin}/error.html?message=Error del servidor`
    );
  }
}