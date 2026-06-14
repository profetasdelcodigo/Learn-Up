import { test, expect } from '@playwright/test';

test.describe('Jarvis Global Widget', () => {
  test('Abre el widget y permite enviar un mensaje', async ({ page }) => {
    // Vamos al dashboard (requiere auth, si la app redirige, esto es un test mock)
    await page.goto('/dashboard');
    
    // El botón orbe flotante
    const orbButton = page.locator('button', { has: page.locator('svg') }).last();
    if (await orbButton.isVisible()) {
       await orbButton.click();
    }
    
    // Verificar que aparece el chat
    const input = page.locator('input[placeholder*="Pídele algo a Jarvis"]');
    await expect(input).toBeVisible();
    
    // Escribir un comando
    await input.fill('Busca Learn Up en internet');
    await input.press('Enter');
    
    // Verificar que aparece un loader o el mensaje en el chat
    await expect(page.locator('text="Busca Learn Up en internet"')).toBeVisible();
  });
});
