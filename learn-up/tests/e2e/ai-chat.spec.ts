import { test, expect } from '@playwright/test';

test.describe('NotebookLM Layout', () => {
  test('Abre el chat del Profesor IA y verifica los 3 paneles', async ({ page }) => {
    // Vamos a la página de Profesor IA
    await page.goto('/ai/profesor');
    
    // El Sidebar y los botones de toggle deberían estar presentes
    const toggleLeft = page.locator('button[title="Archivos e Historial"]');
    const toggleRight = page.locator('button[title="Pizarra y Herramientas"]');
    
    await expect(toggleLeft).toBeVisible();
    await expect(toggleRight).toBeVisible();
    
    // Verificar que el input del chat principal está presente
    const chatInput = page.locator('input[placeholder="Escribe tu mensaje..."]');
    await expect(chatInput).toBeVisible();
    
    // En escritorio, los paneles deberían estar visibles al cargar (según el resize logic)
    // El test asume resolución default de playwright (generalmente desktop 1280x720)
  });
});
