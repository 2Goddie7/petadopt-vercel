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

    console.log('Auth callback iniciado:', { code: code?.substring(0, 20), error });

    // Si hay error de Supabase, redirigir a página de error
    if (error) {
      console.error('Error de autenticación:', error, error_description);
      return Response.redirect(
        `${url.origin}/error.html?message=${encodeURIComponent(error_description || error)}`
      );
    }

    // Si no hay code, algo salió mal
    if (!code) {
      console.error('No se recibió código de autenticación');
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

    if (!data?.session?.access_token) {
      console.error('No se obtuvo sesión válida');
      return Response.redirect(
        `${url.origin}/error.html?message=No se pudo establecer la sesión`
      );
    }

    // Verificar que el usuario tenga perfil
    const userId = data.session.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, user_type')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.warn('Usuario sin perfil, creando...', userId);
      
      // Intentar crear el perfil
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: data.session.user.email,
          full_name: data.session.user.user_metadata?.full_name || 
                     data.session.user.user_metadata?.name || 
                     data.session.user.email?.split('@')[0] || 
                     'Usuario',
          user_type: 'adopter',
          avatar_url: data.session.user.user_metadata?.avatar_url ||
                      data.session.user.user_metadata?.picture
        });

      if (createError) {
        console.error('Error creando perfil:', createError);
        return Response.redirect(
          `${url.origin}/error.html?message=Error creando perfil de usuario`
        );
      }

      console.log('Perfil creado exitosamente');
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
    console.log('Redirigiendo a app con tokens...');
    setTimeout(() => {
      window.location.href = '${redirectUrl}?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}';
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
    
    <div class="spinner"></div>
    
    <div id="fallback" style="display: none;">
      <p>Si no se abre automáticamente:</p>
      <a href="${redirectUrl}?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}" class="button">
        Abrir PetAdopt
      </a>
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
      `${url.origin}/error.html?message=Error del servidor: ${error.message}`
    );
  }
}
