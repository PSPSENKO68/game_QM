const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('dialog', async dialog => {
    console.log('DIALOG:', dialog.message());
    await dialog.accept();
  });

  await page.goto('http://localhost:8081/admin.html', { waitUntil: 'networkidle0' });
  await page.click('#tab_lucky_btn');
  
  console.log("Before click:", await page.$eval('#btn_start_lucky_draw', el => el.textContent.trim()));
  await page.click('#btn_start_lucky_draw');
  await new Promise(r => setTimeout(r, 100)); // wait 100ms
  console.log("After click (100ms):", await page.$eval('#btn_start_lucky_draw', el => el.textContent.trim()));
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("After 2s:", await page.$eval('#btn_start_lucky_draw', el => el.textContent.trim()));

  await browser.close();
})();
