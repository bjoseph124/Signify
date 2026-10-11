import { test, expect } from '@playwright/test';

test('responsive page, letter hints, and no automatic camera access', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', {name:'Start Camera'})).toBeVisible();
  expect(await page.locator('video').evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole('button', {name:'F The circle'}).click();
  await expect(page.getByRole('heading', {name:'Make a little circle'})).toBeVisible();
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('real local MediaPipe worker processes a fake camera and Stop releases tracks', async ({page}) => {
  const requests: string[] = []; page.on('request', req => requests.push(req.url()));
  await page.goto('/');
  await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByText('Camera live',{exact:true})).toBeVisible({timeout:45_000});
  await expect(page.getByText('No hand detected',{exact:true})).toBeVisible();
  await expect(page.locator('.mono')).toContainText(/\d+ FPS/);
  await page.waitForTimeout(1500);
  expect(await page.locator('.mono').innerText()).not.toMatch(/^0 FPS/);
  await page.locator('video').evaluate(v => { (window as any).__tracks = ((v as HTMLVideoElement).srcObject as MediaStream).getTracks(); });
  await page.getByRole('button',{name:'Stop Camera'}).click();
  expect(await page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  expect(requests.every(url=>url.startsWith('http://127.0.0.1:4173/') || url.startsWith('blob:'))).toBe(true);
  expect(requests.some(url=>url.endsWith('hand_landmarker.task'))).toBe(true);
  await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByText('Camera live',{exact:true})).toBeVisible({timeout:45_000});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Start Camera'})).toBeVisible();
});

test('permission denial is actionable and retry remains available', async ({page}) => {
  await page.addInitScript(()=> { navigator.mediaDevices.getUserMedia = async () => {throw new DOMException('Denied','NotAllowedError');}; });
  await page.goto('/'); await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied');
  await expect(page.getByRole('button',{name:'Start Camera'})).toBeVisible();
});

test('Stop cancels startup and releases a late permission result', async ({page}) => {
  await page.addInitScript(()=> {
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
      (window as any).__grant = () => {
        const canvas = document.createElement('canvas');
        const stream = canvas.captureStream(); (window as any).__lateTracks = stream.getTracks(); resolve(stream);
      };
    });
  });
  await page.goto('/'); await page.getByRole('button',{name:'Start Camera'}).click();
  await page.getByRole('button',{name:'Stop Camera'}).click();
  await page.evaluate(()=>(window as any).__grant());
  await expect.poll(()=>page.evaluate(()=>(window as any).__lateTracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await expect(page.getByRole('button',{name:'Start Camera'})).toBeVisible();
});

test('model load failure cleans up the camera', async ({page}) => {
  await page.route('**/models/hand_landmarker.task', route=>route.abort());
  await page.goto('/'); await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByRole('alert')).toContainText('could not load',{timeout:45_000});
  expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).srcObject)).toBeNull();
});

test('hiding the page releases the camera', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByText('Camera live',{exact:true})).toBeVisible({timeout:45_000});
  await page.locator('video').evaluate(v => { (window as any).__tracks = ((v as HTMLVideoElement).srcObject as MediaStream).getTracks(); });
  await page.evaluate(()=> {
    Object.defineProperty(document, 'hidden', {configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button',{name:'Start Camera'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__tracks.every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});

test('research lab is opt-in and explicit recording downloads only local landmark data', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Help the alphabet grow.'})).toHaveCount(0);
  await page.goto('/?lab=alphabet');
  await expect(page.getByRole('heading',{name:'Help the alphabet grow.'})).toBeVisible();
  await page.getByText('Record a local evaluation sample',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Record 4 seconds'})).toBeDisabled();
  await page.getByRole('button',{name:'Start Camera'}).click();
  await expect(page.getByText('Camera live',{exact:true})).toBeVisible({timeout:45_000});
  await expect(page.locator('.motion-readout')).toContainText('Unknown');
  await page.getByLabel('Anonymous signer ID').fill('test-signer');
  await page.getByRole('button',{name:'Record 4 seconds'}).click();
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Finish sample'}).click();
  await expect(page.getByRole('status')).toContainText('Nothing uploaded');
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download sample'}).click();
  const download=await downloaded;
  const stream=await download.createReadStream();const chunks=[];
  for await(const chunk of stream!)chunks.push(chunk);
  const data=JSON.parse(Buffer.concat(chunks).toString());
  expect(data.schema).toBe('signify-landmarks-v1');expect(data.label).toBe('J');
  expect(data.frames.length).toBeGreaterThan(0);expect(data.frames.every((f:any)=>f.points===null)).toBe(true);
  await page.getByRole('button',{name:'Stop Camera'}).click();
  await expect(page.locator('.motion-readout')).toContainText('Unknown');
});
