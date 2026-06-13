import { rgb } from 'pdf-lib';

export function drawAdminStampClassic(page, {
  x, y, w, h,
  responsibleName, responsibleRole, signedAt,
  signatureImage, logoImage,
  helv, helvBold, courier,
}) {
  const INK_BLUE = rgb(0.059, 0.247, 0.529);
  const SLATE_200 = rgb(0.886, 0.910, 0.941);
  const SLATE_500 = rgb(0.392, 0.455, 0.545);
  const SLATE_600 = rgb(0.278, 0.337, 0.412);
  const SLATE_900 = rgb(0.059, 0.090, 0.165);
  const SLATE_50 = rgb(0.973, 0.980, 0.988);
  const WHITE = rgb(1, 1, 1);

  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderColor: SLATE_200, borderWidth: 0.5 });
  const TOP_BAR_H = 2;
  page.drawRectangle({ x, y: y + h - TOP_BAR_H, width: w, height: TOP_BAR_H, color: INK_BLUE });

  const PAD = 6;
  const headerY = y + h - TOP_BAR_H - 8;

  if (logoImage) {
    const logoH = 10;
    const logoW = (logoImage.width / logoImage.height) * logoH;
    page.drawImage(logoImage, { x: x + PAD, y: headerY - 3, width: logoW, height: logoH });
  }

  const labelText = 'ASSINATURA QUALIFICADA';
  const labelW = helvBold.widthOfTextAtSize(labelText, 4.5);
  page.drawText(labelText, {
    x: x + w - PAD - labelW, y: headerY + 1, size: 4.5, font: helvBold, color: SLATE_500,
  });

  const divY = headerY - 6;
  page.drawLine({
    start: { x: x + PAD, y: divY },
    end: { x: x + w - PAD, y: divY },
    thickness: 0.3, color: SLATE_200,
  });

  if (logoImage) {
    const wmH = h * 0.7;
    const wmW = (logoImage.width / logoImage.height) * wmH;
    page.drawImage(logoImage, {
      x: x + (w - wmW) / 2,
      y: y + (h - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.06,
    });
  }

  if (signatureImage) {
    const sigAreaH = divY - (y + 14);
    const sigAreaW = w - PAD * 2;
    const aspect = signatureImage.width / signatureImage.height;
    let drawW, drawH;
    if (aspect > sigAreaW / sigAreaH) {
      drawW = sigAreaW;
      drawH = drawW / aspect;
    } else {
      drawH = sigAreaH;
      drawW = drawH * aspect;
    }
    page.drawImage(signatureImage, {
      x: x + (w - drawW) / 2,
      y: y + 14 + (sigAreaH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const footerH = 11;
  page.drawRectangle({ x, y, width: w, height: footerH, color: SLATE_50 });

  page.drawText(String(responsibleName || 'Responsável Legal'), {
    x: x + PAD, y: y + 5, size: 7, font: helvBold, color: SLATE_900,
  });
  if (responsibleRole) {
    const roleStr = String(responsibleRole);
    const nameW = helvBold.widthOfTextAtSize(String(responsibleName || ''), 7);
    page.drawText(`— ${roleStr}`, {
      x: x + PAD + nameW + 4, y: y + 5, size: 5, font: helv, color: SLATE_600,
    });
  }

  let dateStr = '';
  if (signedAt) {
    const d = new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dateW = courier.widthOfTextAtSize(dateStr, 5.5);
  page.drawText(dateStr, {
    x: x + w - PAD - dateW, y: y + 5, size: 5.5, font: courier, color: SLATE_600,
  });
}

export function drawAdminStampCorporate(page, {
  x, y, w, h,
  companyName, responsibleName, responsibleRole, signedAt,
  signatureImage, logoImage,
  helv, helvBold, courier,
}) {
  const NAVY = rgb(0.043, 0.114, 0.227);
  const NAVY_SOFT = rgb(0.078, 0.165, 0.322);
  const GOLD = rgb(0.788, 0.635, 0.294);
  const GOLD_DEEP = rgb(0.627, 0.494, 0.173);
  const PAPER = rgb(0.980, 0.980, 0.969);
  const SLATE = rgb(0.278, 0.337, 0.412);
  const SLATE_SOFT = rgb(0.580, 0.639, 0.722);
  const INK = rgb(0.059, 0.090, 0.165);
  const WHITE = rgb(1, 1, 1);

  page.drawRectangle({ x, y, width: w, height: h, color: PAPER, borderColor: NAVY_SOFT, borderWidth: 0.5 });

  const HEADER_H = 12;
  const headerY = y + h - HEADER_H;
  page.drawRectangle({ x, y: headerY, width: w, height: HEADER_H, color: NAVY });
  page.drawRectangle({ x, y: headerY - 0.8, width: w, height: 0.8, color: GOLD });

  const PAD = 5;
  const logoBoxH = HEADER_H - 3;
  const logoBoxW = logoBoxH;
  if (logoImage) {
    page.drawRectangle({ x: x + PAD, y: headerY + 1.5, width: logoBoxW, height: logoBoxH, color: WHITE });
    const inset = 1;
    const innerW = logoBoxW - inset * 2;
    const innerH = logoBoxH - inset * 2;
    const aspect = logoImage.width / logoImage.height;
    let lw = innerW, lh = innerH;
    if (aspect > innerW / innerH) lh = lw / aspect;
    else lw = lh * aspect;
    page.drawImage(logoImage, {
      x: x + PAD + inset + (innerW - lw) / 2,
      y: headerY + 1.5 + inset + (innerH - lh) / 2,
      width: lw,
      height: lh,
    });
  }

  const titleX = x + PAD + logoBoxW + 4;
  const titleStr = String(companyName || 'MAGNETIC PLACE').toUpperCase();
  page.drawText(titleStr, { x: titleX, y: headerY + 6, size: 8, font: helvBold, color: WHITE });
  page.drawText('GLOBAL WORKFORCE SOLUTIONS', { x: titleX, y: headerY + 1.5, size: 3.5, font: helvBold, color: GOLD });

  const sealR = (HEADER_H - 2) / 2;
  const sealCx = x + w - PAD - sealR;
  const sealCy = headerY + HEADER_H / 2;
  page.drawCircle({ x: sealCx, y: sealCy, size: sealR, borderColor: GOLD, borderWidth: 0.5 });
  const certStr = 'CERTIFIED';
  const certW = helvBold.widthOfTextAtSize(certStr, 2.5);
  page.drawText(certStr, { x: sealCx - certW / 2, y: sealCy + 0.5, size: 2.5, font: helvBold, color: GOLD });
  const origStr = 'ORIGINAL';
  const origW = helvBold.widthOfTextAtSize(origStr, 2.2);
  page.drawText(origStr, { x: sealCx - origW / 2, y: sealCy - 2.5, size: 2.2, font: helvBold, color: GOLD });

  if (logoImage) {
    const bodyH = h - HEADER_H - 11;
    const wmH = bodyH * 0.95;
    const wmW = (logoImage.width / logoImage.height) * wmH;
    page.drawImage(logoImage, {
      x: x + w - wmW - 2,
      y: y + 11 + (bodyH - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.05,
    });
  }

  const bodyMidY = y + 11 + (h - HEADER_H - 11) / 2;
  if (logoImage) {
    const mr = 6;
    page.drawCircle({ x: x + PAD + mr, y: bodyMidY, size: mr, color: WHITE, borderColor: NAVY_SOFT, borderWidth: 0.4 });
    const mInner = mr * 1.3;
    const aspect = logoImage.width / logoImage.height;
    let mw = mInner, mh = mInner;
    if (aspect > 1) mh = mw / aspect;
    else mw = mh * aspect;
    page.drawImage(logoImage, {
      x: x + PAD + mr - mw / 2,
      y: bodyMidY - mh / 2,
      width: mw,
      height: mh,
      opacity: 0.85,
    });
  }

  const availX = x + PAD + 16;
  const availY = y + 12;
  const availW = w - PAD * 2 - 18;
  const availH = h - HEADER_H - 14;
  let boxW = availW;
  let boxH = boxW / 2;
  if (boxH > availH) { boxH = availH; boxW = boxH * 2; }
  const boxX = availX + (availW - boxW) / 2;
  const boxY = availY + (availH - boxH) / 2;
  page.drawRectangle({
    x: boxX, y: boxY, width: boxW, height: boxH,
    color: WHITE, borderColor: NAVY_SOFT, borderWidth: 0.3,
  });

  if (signatureImage) {
    const innerPad = 1.5;
    const innerW = boxW - innerPad * 2;
    const innerH = boxH - innerPad * 2;
    const aspect = signatureImage.width / signatureImage.height;
    let drawW, drawH;
    if (aspect > innerW / innerH) {
      drawW = innerW; drawH = drawW / aspect;
    } else {
      drawH = innerH; drawW = drawH * aspect;
    }
    page.drawImage(signatureImage, {
      x: boxX + (boxW - drawW) / 2,
      y: boxY + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const footerH = 10;
  page.drawLine({
    start: { x: x + PAD, y: y + footerH + 0.5 },
    end: { x: x + w - PAD, y: y + footerH + 0.5 },
    thickness: 0.3, color: NAVY_SOFT,
  });

  const nameStr = String(responsibleName || 'Responsável Legal');
  page.drawText(nameStr, { x: x + PAD, y: y + 5, size: 6.5, font: helvBold, color: INK });
  if (responsibleRole) {
    const nameW = helvBold.widthOfTextAtSize(nameStr, 6.5);
    page.drawText(`· ${String(responsibleRole).toUpperCase()}`, {
      x: x + PAD + nameW + 3, y: y + 5, size: 4, font: helvBold, color: SLATE,
    });
  }
  page.drawText('Lisboa · Porto · Madrid', { x: x + PAD, y: y + 1.5, size: 3.2, font: helv, color: SLATE_SOFT });

  const authStr = 'AUTHENTICATED';
  const authW = helvBold.widthOfTextAtSize(authStr, 3.2);
  page.drawText(authStr, { x: x + w - PAD - authW, y: y + 7, size: 3.2, font: helvBold, color: GOLD_DEEP });
  let dateStr = '';
  if (signedAt) {
    const d = new Date(signedAt);
    const pad = (n) => String(n).padStart(2, '0');
    dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dateW = courier.widthOfTextAtSize(dateStr, 4.5);
  page.drawText(dateStr, { x: x + w - PAD - dateW, y: y + 3, size: 4.5, font: courier, color: SLATE });
  const serial = (signedAt || '').replace(/[^0-9]/g, '').slice(0, 14);
  const serialStr = `SN · ${serial}`;
  const serialW = courier.widthOfTextAtSize(serialStr, 3);
  page.drawText(serialStr, { x: x + w - PAD - serialW, y: y + 0.5, size: 3, font: courier, color: SLATE_SOFT });
}
