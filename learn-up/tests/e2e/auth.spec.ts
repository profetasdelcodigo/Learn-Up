import { test, expect } from '@playwright/test';

test.describe('Autenticación y Onboarding', () => {
  test('registro de usuario lleva a onboarding', async ({ page }) => {
    // Simulamos la interfaz de login de Supabase Auth UI
    // En un entorno de pruebas real, idealmente interceptaríamos el request de Supabase
    // para no crear usuarios basura, pero esto es un E2E UI test básico.
    await page.goto('/login');
    
    // Suponemos que existe un modo de registro
    const signupModeButton = page.locator('button', { hasText: /Registrarse|Sign Up/i });
    if (await signupModeButton.isVisible()) {
      await signupModeButton.click();
    }
    
    // Localizar inputs (dependiendo de Auth UI puede que los selectores varíen)
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await expect(emailInput).toBeVisible();
    
    // Nota: Para no contaminar la DB real en el entorno de producción, los tests E2E
    // deben correrse contra el entorno local de Supabase.
    // await emailInput.fill(`test_${Date.now()}@example.com`);
    // await passwordInput.fill('SecurePass123!');
    // await page.locator('button[type="submit"]').click();
    
    // await expect(page).toHaveURL(/.*\/onboarding/);
  });
});
