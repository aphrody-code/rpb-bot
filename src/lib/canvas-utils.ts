import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';

// Register fonts
const fontPath =
  '/root/rpb-dashboard/public/Google_Sans_Flex/static/GoogleSansFlex_72pt-Bold.ttf';
GlobalFonts.registerFromPath(fontPath, 'GoogleSans');

export async function generateWelcomeImage(
  displayName: string,
  avatarUrl: string,
  memberCount: number,
) {
  // Create canvas (standard Discord embed size-ish: 800x400)
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background path
  const bgPath = '/root/rpb-dashboard/public/banner.png';

  try {
    const background = await loadImage(bgPath);
    ctx.drawImage(background, 0, 0, width, height);
  } catch (_e) {
    // Fallback if image fails to load
    ctx.fillStyle = '#dc2626'; // RPB Red
    ctx.fillRect(0, 0, width, height);
  }

  // Add a semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, width, height);

  // Draw Avatar Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 200, 100, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  try {
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 50, 100, 200, 200);
  } catch (_e) {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.restore();

  // Add Avatar Border
  ctx.strokeStyle = '#fbbf24'; // RPB Gold
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(150, 200, 100, 0, Math.PI * 2, true);
  ctx.stroke();

  // Text: Welcome to RPB
  ctx.font = 'bold 48px GoogleSans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('BIENVENUE À LA', 300, 150);

  ctx.font = 'bold 64px GoogleSans';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('RPB !', 300, 210);

  // Username
  ctx.font = '32px GoogleSans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayName.toUpperCase(), 300, 270);

  // Member count
  ctx.font = '24px GoogleSans';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(`MEMBRE #${memberCount}`, 300, 310);

  // Return the buffer
  return canvas.toBuffer('image/png');
}
