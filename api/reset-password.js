import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token'); // Solo RecoveryToken

    // ✅ Validar token
    if (!token) {
      return Response.redirect(`${url.origin}/error.html?message=Token no válido`);
    }

    // Configurar Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // POST = actualizar contraseña
    if (req.method === 'POST') {
      const body = await req.json();
      const { password } = body;

      if (!password || password.length < 6) {
        return new Response(
          JSON.stringify({
            error: 'La contraseña debe tener al menos 6 caracteres'
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 🔑 Usar el token de recuperación para actualizar la contraseña
      const { data, error } = await supabase.auth.updateUser(
        { password },
        { token } // importante: token = RecoveryToken
      );

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Contraseña actualizada correctamente'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // GET = mostrar formulario
    const redirectUrl = process.env.REDIRECT_URL_SUCCESS || 'petadopt://auth/success';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - PetAdopt</title>
  <link rel="stylesheet" href="/styles/auth.css">
</head>
<body>
  <div class="container">
    <div class="logo">🐾</div>
    <h1>Restablecer Contraseña</h1>
    <p>Ingresa tu nueva contraseña</p>
    
    <form id="resetForm">
      <div class="form-group">
        <label for="password">Nueva Contraseña</label>
        <input type="password" id="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres">
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Confirmar Contraseña</label>
        <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6" placeholder="Repite la contraseña">
      </div>
      
      <button type="submit" class="button" id="submitBtn">Actualizar Contraseña</button>
      <div id="message" class="message"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('resetForm');
    const message = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        message.className = 'message error';
        message.textContent = 'Las contraseñas no coinciden';
        return;
      }

      if (password.length < 6) {
        message.className = 'message error';
        message.textContent = 'La contraseña debe tener al menos 6 caracteres';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Actualizando...';

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token'); // Solo RecoveryToken

        const response = await fetch(window.location.pathname + window.location.search, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, token })
        });

        const data = await response.json();

        if (data.success) {
          message.className = 'message success';
          message.textContent = '✓ Contraseña actualizada. Redirigiendo...';
          setTimeout(() => { window.location.href = '${redirectUrl}'; }, 2000);
        } else {
          throw new Error(data.error || 'Error al actualizar contraseña');
        }
      } catch (error) {
        message.className = 'message error';
        message.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Actualizar Contraseña';
      }
    });
  </script>
</body>
</html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error en reset-password:', error);
    return Response.redirect(`${req.url.origin}/error.html?message=Error del servidor`);
  }
}
