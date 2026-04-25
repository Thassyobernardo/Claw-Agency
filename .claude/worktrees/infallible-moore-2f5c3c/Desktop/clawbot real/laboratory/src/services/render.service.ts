// @ts-ignore
import nodeHtmlToImage from "node-html-to-image";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.join(process.cwd(), "output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// User requested: Text directly on image, no white boxes, Plus Jakarta Sans, Electric Orange accents.
const TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
    
    body {
      width: 1080px;
      height: 1080px;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      overflow: hidden;
      color: #FFFFFF;
      background-color: #121212;
    }
    
    .background {
      width: 100%;
      height: 100%;
      background-image: url('{{backgroundImage}}');
      background-size: cover;
      background-position: center;
      position: absolute;
      top: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 100px 120px;
      box-sizing: border-box;
      background-color: #121212;
    }

    /* Subtle gradient purely to guarantee text reads perfectly on complex background, no white boxes */
    .background::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 60%;
      background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      z-index: 1;
    }
    
    .content-wrapper {
      z-index: 2;
    }

    .brand {
      color: #FF5722;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 4px;
      font-size: 24px;
      margin-bottom: 60px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    h1 {
      font-size: 80px;
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 50px 0;
      letter-spacing: -2px;
    }
    
    p {
      font-size: 38px;
      font-weight: 400;
      line-height: 1.5;
      margin: 0;
      opacity: 0.9;
    }

    .footer {
      position: absolute;
      bottom: 80px;
      left: 120px;
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 2px;
      opacity: 0.8;
      z-index: 2;
    }
    .footer-right {
      position: absolute;
      bottom: 80px;
      right: 120px;
      font-weight: 800;
      font-size: 24px;
      opacity: 0.8;
      color: #FF5722;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="background">
    <div class="content-wrapper">
      <div class="brand">CLAW AGENCY // HYBRID</div>
      <h1>{{title}}</h1>
      <p>{{text}}</p>
    </div>

    <div class="footer">CLAWAGENCY.ONLINE</div>
    <div class="footer-right">{{slideNum}}/5</div>
  </div>
</body>
</html>
`;

export async function renderSlide(slideData: any, slideIndex: number, backgroundImage: string, fileName: string) {
  const outputPath = path.join(OUTPUT_DIR, fileName);
  
  console.log(`📸 Render: Rendering cinematic slide to ${fileName}...`);

  try {
    await nodeHtmlToImage({
      output: outputPath,
      html: TEMPLATE,
      content: {
        title: slideData.title,
        text: slideData.text || slideData.subtitle,
        slideNum: slideIndex + 1,
        backgroundImage
      },
      puppeteerArgs: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: { width: 1080, height: 1080 }
      }
    });
    
    console.log(`✅ Render: Finished ${fileName}`);
    return outputPath;
  } catch (err) {
    console.error(`❌ Render: Failed for ${fileName}:`, err);
    throw err;
  }
}
