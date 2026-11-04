export async function goToNav(page, label) {
    const hamburgerMenu = page.getByRole('button', { name: /menu/i });
    if(await hamburgerMenu.isVisible()) await hamburgerMenu.click();

    const nav = page.getByRole('navigation', { name: 'Main'});
    await nav.getByRole('link', { name: label}).click();
}