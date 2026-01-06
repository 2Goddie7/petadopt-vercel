import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

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

      try {
        // 🔑 NUEVA ESTRATEGIA: Usar verifyOtp directamente
        // Los tokens PKCE NO funcionan para password recovery
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });

        if (error) {
          console.error('Error verificando token:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Token inválido o expirado. Solicita un nuevo enlace de recuperación.',
              details: error.message 
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Si llegamos aquí, el token es válido y tenemos una sesión
        // Ahora actualizar la contraseña
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) {
          console.error('Error actualizando contraseña:', updateError);
          return new Response(
            JSON.stringify({ 
              error: 'No se pudo actualizar la contraseña',
              details: updateError.message 
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Contraseña actualizada correctamente'
          }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      } catch (error) {
        console.error('Error en el proceso:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Error del servidor al procesar la solicitud',
            details: error.message
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET = mostrar formulario de reset
    const redirectUrl = process.env.REDIRECT_URL_SUCCESS || 'petadopt://auth/success';

    const resetFormHTML = `
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

    <form id="resetForm" style="margin-top: 30px;">
      <div class="form-group">
        <label for="password">Nueva Contraseña</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minlength="6"
          placeholder="Mínimo 6 caracteres"
        >
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirmar Contraseña</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          required
          placeholder="Repite tu contraseña"
        >
      </div>

      <button type="submit" class="button" id="submitBtn">
        Actualizar Contraseña
      </button>

      <div id="message" class="message" style="display: none;"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('resetForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const message = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (password !== confirmPassword) {
        showMessage('Las contraseñas no coinciden', 'error');
        return;
      }

      if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Actualizando...';

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showMessage('¡Contraseña actualizada! Redirigiendo...', 'success');
          setTimeout(() => {
            window.location.href = '${redirectUrl}?message=password_updated';
          }, 2000);
        } else {
          showMessage(data.error || 'Error al actualizar contraseña', 'error');
          if (data.details) {
            console.error('Detalles:', data.details);
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Actualizar Contraseña';
        }
      } catch (error) {
        console.error('Error:', error);
        showMessage('Error de conexión. Intenta nuevamente.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Actualizar Contraseña';
      }
    });

    function showMessage(text, type) {
      message.textContent = text;
      message.className = 'message ' + type;
      message.style.display = 'block';
    }

    confirmPasswordInput.addEventListener('input', () => {
      if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.setCustomValidity('Las contraseñas no coinciden');
      } else {
        confirmPasswordInput.setCustomValidity('');
      }
    });
  </script>
</body>
</html>
    `;

    return new Response(resetFormHTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error en reset-password:', error);
    return Response.redirect(
      `${url.origin}/error.html?message=Error del servidor`
    );
  }
}
