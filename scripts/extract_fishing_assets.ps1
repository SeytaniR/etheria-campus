param(
  [string]$OutBaseDir = "C:\Users\Dani\.gemini\antigravity\scratch\etheria-campus\apps\server\public\play\assets\fishing",
  [string]$PreviewDir = "C:\Users\Dani\.gemini\antigravity\brain\f5a3413a-c42d-4c86-b4ac-a89167d28d54\scratch"
)

$ErrorActionPreference = "Stop"

$csharp = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

public static class FishingAssetExtractor {
    private sealed class Comp {
        public int Id;
        public int Area;
        public double SumX;
        public double SumY;
        public int MinX = int.MaxValue;
        public int MinY = int.MaxValue;
        public int MaxX = int.MinValue;
        public int MaxY = int.MinValue;
        public List<int> Pixels = new List<int>();
        public double Cx { get { return SumX / Math.Max(1, Area); } }
        public double Cy { get { return SumY / Math.Max(1, Area); } }
    }

    public static void ProcessSheet(
        string inputPath,
        string outDir,
        string previewPath,
        string[] names12,
        bool cleanEnclosedWhitePockets
    ) {
        if (names12.Length != 12) throw new ArgumentException("Esperados exatamente 12 nomes por folha.");
        Directory.CreateDirectory(outDir);
        Directory.CreateDirectory(Path.GetDirectoryName(previewPath));

        using (var srcOrig = new Bitmap(inputPath))
        using (var bmp = new Bitmap(srcOrig.Width, srcOrig.Height, PixelFormat.Format32bppArgb)) {
            using (var g = Graphics.FromImage(bmp)) {
                g.DrawImage(srcOrig, 0, 0, srcOrig.Width, srcOrig.Height);
            }

            int w = bmp.Width;
            int h = bmp.Height;
            int total = w * h;
            var rect = new Rectangle(0, 0, w, h);
            var bd = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] raw = new byte[total * 4];
            Marshal.Copy(bd.Scan0, raw, 0, raw.Length);
            bmp.UnlockBits(bd);

            // 1. Flood fill BFS a partir do perímetro removendo fundo branco/cinza muito claro do JPEG
            bool[] isBg = new bool[total];
            var q = new Queue<int>(4096);

            Func<int, bool> isSeedWhite = (idx) => {
                int o = idx * 4;
                int b = raw[o], gr = raw[o + 1], r = raw[o + 2];
                int min = Math.Min(r, Math.Min(gr, b));
                int max = Math.Max(r, Math.Max(gr, b));
                return min >= 232 && (max - min) <= 24;
            };

            Func<int, bool> isFloodWhite = (idx) => {
                int o = idx * 4;
                int b = raw[o], gr = raw[o + 1], r = raw[o + 2];
                int min = Math.Min(r, Math.Min(gr, b));
                int max = Math.Max(r, Math.Max(gr, b));
                return min >= 224 && (max - min) <= 28;
            };

            for (int x = 0; x < w; x++) {
                int top = x;
                int bot = (h - 1) * w + x;
                if (!isBg[top] && isSeedWhite(top)) { isBg[top] = true; q.Enqueue(top); }
                if (!isBg[bot] && isSeedWhite(bot)) { isBg[bot] = true; q.Enqueue(bot); }
            }
            for (int y = 0; y < h; y++) {
                int left = y * w;
                int right = y * w + (w - 1);
                if (!isBg[left] && isSeedWhite(left)) { isBg[left] = true; q.Enqueue(left); }
                if (!isBg[right] && isSeedWhite(right)) { isBg[right] = true; q.Enqueue(right); }
            }

            int[] dx4 = { 1, -1, 0, 0 };
            int[] dy4 = { 0, 0, 1, -1 };
            while (q.Count > 0) {
                int cur = q.Dequeue();
                int cx = cur % w, cy = cur / w;
                for (int d = 0; d < 4; d++) {
                    int nx = cx + dx4[d], ny = cy + dy4[d];
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    int ni = ny * w + nx;
                    if (!isBg[ni] && isFloodWhite(ni)) {
                        isBg[ni] = true;
                        q.Enqueue(ni);
                    }
                }
            }

            // 1b. Limpeza seletiva de bolsos fechados (vão entre haste/linha nas Varas e anzóis nas Iscas)
            if (cleanEnclosedWhitePockets) {
                bool[] seenHole = new bool[total];
                for (int i = 0; i < total; i++) {
                    if (isBg[i] || seenHole[i]) continue;
                    int o = i * 4;
                    int r0 = raw[o + 2], g0 = raw[o + 1], b0 = raw[o];
                    int mn0 = Math.Min(r0, Math.Min(g0, b0));
                    int mx0 = Math.Max(r0, Math.Max(g0, b0));
                    if (mn0 < 245 || (mx0 - mn0) > 10) continue;

                    var region = new List<int>();
                    var hq = new Queue<int>();
                    seenHole[i] = true;
                    hq.Enqueue(i);
                    long sumMin = 0;
                    int pureWhiteCount = 0;
                    int rMinX = w, rMaxX = 0, rMinY = h, rMaxY = 0;

                    while (hq.Count > 0) {
                        int c = hq.Dequeue();
                        region.Add(c);
                        int co = c * 4;
                        int cr = raw[co + 2], cg = raw[co + 1], cb = raw[co];
                        int cmn = Math.Min(cr, Math.Min(cg, cb));
                        int cmx = Math.Max(cr, Math.Max(cg, cb));
                        sumMin += cmn;
                        if (cmn >= 246 && (cmx - cmn) <= 10) pureWhiteCount++;

                        int px = c % w, py = c / w;
                        if (px < rMinX) rMinX = px; if (px > rMaxX) rMaxX = px;
                        if (py < rMinY) rMinY = py; if (py > rMaxY) rMaxY = py;

                        for (int d = 0; d < 4; d++) {
                            int nx = px + dx4[d], ny = py + dy4[d];
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                            int ni = ny * w + nx;
                            if (isBg[ni] || seenHole[ni]) continue;
                            int no = ni * 4;
                            int nr = raw[no + 2], ng = raw[no + 1], nb = raw[no];
                            int nmn = Math.Min(nr, Math.Min(ng, nb));
                            int nmx = Math.Max(nr, Math.Max(ng, nb));
                            if (nmn >= 224 && (nmx - nmn) <= 30) {
                                seenHole[ni] = true;
                                hq.Enqueue(ni);
                            }
                        }
                    }

                    double avgMin = (double)sumMin / Math.Max(1, region.Count);
                    double pureRatio = (double)pureWhiteCount / Math.Max(1, region.Count);
                    int bw = rMaxX - rMinX + 1;
                    int bh = rMaxY - rMinY + 1;
                    if (region.Count >= 16 && avgMin >= 236.0 && (pureRatio >= 0.30 || pureWhiteCount >= 12) && (bw >= 4 || bh >= 4)) {
                        foreach (int pi in region) isBg[pi] = true;
                    }
                }
            }

            // 1c. Mapa de halo externo continuo a partir do fundo sem atravessar contornos escuros
            // Resolve auras esbranquicadas ao redor das varas magicas (Glacial, Dragao, Leviata, Cosmica)
            bool[] isOuterGlow = new bool[total];
            int[] glowDist = new int[total];
            var gq = new Queue<int>(4096);
            for (int i = 0; i < total; i++) {
                if (!isBg[i]) continue;
                int px = i % w, py = i / w;
                for (int d = 0; d < 4; d++) {
                    int nx = px + dx4[d], ny = py + dy4[d];
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    int ni = ny * w + nx;
                    if (isBg[ni] || isOuterGlow[ni]) continue;
                    int no = ni * 4;
                    int nr = raw[no + 2], ng = raw[no + 1], nb = raw[no];
                    int nmn = Math.Min(nr, Math.Min(ng, nb));
                    int nmx = Math.Max(nr, Math.Max(ng, nb));
                    if (nmn >= 182 && nmx >= 222) {
                        isOuterGlow[ni] = true;
                        glowDist[ni] = 1;
                        gq.Enqueue(ni);
                    }
                }
            }
            while (gq.Count > 0) {
                int c = gq.Dequeue();
                int dist = glowDist[c];
                if (dist >= 14) continue;
                int px = c % w, py = c / w;
                for (int d = 0; d < 4; d++) {
                    int nx = px + dx4[d], ny = py + dy4[d];
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    int ni = ny * w + nx;
                    if (isBg[ni] || isOuterGlow[ni]) continue;
                    int no = ni * 4;
                    int nr = raw[no + 2], ng = raw[no + 1], nb = raw[no];
                    int nmn = Math.Min(nr, Math.Min(ng, nb));
                    int nmx = Math.Max(nr, Math.Max(ng, nb));
                    if (nmn >= 190 && nmx >= 228) {
                        isOuterGlow[ni] = true;
                        glowDist[ni] = dist + 1;
                        gq.Enqueue(ni);
                    }
                }
            }

            // 2. Defringing e Anti-aliasing de borda contra fundo branco
            bool[] ring1 = new bool[total];
            bool[] ring2 = new bool[total];
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int idx = y * w + x;
                    if (isBg[idx]) continue;
                    bool adjBg = false;
                    for (int dy = -1; dy <= 1 && !adjBg; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int nx = x + dx, ny = y + dy;
                            if (nx >= 0 && ny >= 0 && nx < w && ny < h && isBg[ny * w + nx]) {
                                adjBg = true;
                                break;
                            }
                        }
                    }
                    if (adjBg) ring1[idx] = true;
                }
            }
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int idx = y * w + x;
                    if (isBg[idx] || ring1[idx]) continue;
                    bool adjR1 = false;
                    for (int dy = -1; dy <= 1 && !adjR1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int nx = x + dx, ny = y + dy;
                            if (nx >= 0 && ny >= 0 && nx < w && ny < h && ring1[ny * w + nx]) {
                                adjR1 = true;
                                break;
                            }
                        }
                    }
                    if (adjR1) ring2[idx] = true;
                }
            }

            byte[] outArgb = new byte[total * 4];
            for (int i = 0; i < total; i++) {
                int o = i * 4;
                if (isBg[i]) {
                    outArgb[o] = 0; outArgb[o + 1] = 0; outArgb[o + 2] = 0; outArgb[o + 3] = 0;
                    continue;
                }
                int b = raw[o], gr = raw[o + 1], r = raw[o + 2];
                int min = Math.Min(r, Math.Min(gr, b));
                int max = Math.Max(r, Math.Max(gr, b));
                int sat = max - min;
                byte a = 255;
                int outR = r, outG = gr, outB = b;

                if (isOuterGlow[i]) {
                    if (min >= 248 && sat <= 10) {
                        a = 0;
                    } else if (sat <= 16) {
                        double af = Clamp((248.0 - min) / 68.0, 0.0, 0.72);
                        a = (byte)Math.Round(af * 255.0);
                        double denom = Math.Max(0.22, af);
                        outR = ClampInt((int)Math.Round((r - (1.0 - af) * 255.0) / denom), 0, 255);
                        outG = ClampInt((int)Math.Round((gr - (1.0 - af) * 255.0) / denom), 0, 255);
                        outB = ClampInt((int)Math.Round((b - (1.0 - af) * 255.0) / denom), 0, 255);
                    } else {
                        // Matting colorido suave: quanto mais claro/branco, menor alpha mantendo cor viva
                        double af = Clamp((254.0 - min) / 110.0, 0.08, 0.78);
                        a = (byte)Math.Round(af * 255.0);
                        double denom = Math.Max(0.25, af);
                        outR = ClampInt((int)Math.Round((r - (1.0 - af) * 255.0) / denom), 0, 255);
                        outG = ClampInt((int)Math.Round((gr - (1.0 - af) * 255.0) / denom), 0, 255);
                        outB = ClampInt((int)Math.Round((b - (1.0 - af) * 255.0) / denom), 0, 255);
                    }
                } else if (ring1[i]) {
                    if (min >= 242 && sat <= 14) {
                        a = 0;
                    } else if (min >= 180) {
                        double af = sat <= 20
                            ? Clamp((246.0 - min) / 72.0, 0.0, 1.0)
                            : Clamp((255.0 - min) * 1.45 / 100.0, 0.12, 1.0);
                        a = (byte)Math.Round(af * 255.0);
                        double denom = Math.Max(0.20, af);
                        outR = ClampInt((int)Math.Round((r - (1.0 - af) * 255.0) / denom), 0, 255);
                        outG = ClampInt((int)Math.Round((gr - (1.0 - af) * 255.0) / denom), 0, 255);
                        outB = ClampInt((int)Math.Round((b - (1.0 - af) * 255.0) / denom), 0, 255);
                    } else if (min >= 125 && sat <= 18) {
                        // Suavização leve em pixels cinzentos de anti-aliasing de contorno escuro
                        double af = Clamp((252.0 - min) / 132.0, 0.45, 1.0);
                        a = (byte)Math.Round(af * 255.0);
                        outR = ClampInt((int)Math.Round((r - (1.0 - af) * 255.0) / af), 0, 255);
                        outG = ClampInt((int)Math.Round((gr - (1.0 - af) * 255.0) / af), 0, 255);
                        outB = ClampInt((int)Math.Round((b - (1.0 - af) * 255.0) / af), 0, 255);
                    }
                } else if (ring2[i] && min >= 225) {
                    double af = sat <= 18
                        ? Clamp((250.0 - min) / 42.0, 0.0, 1.0)
                        : Clamp((255.0 - min) * 1.7 / 70.0, 0.25, 1.0);
                    a = (byte)Math.Round(af * 255.0);
                    double denom = Math.Max(0.28, af);
                    outR = ClampInt((int)Math.Round((r - (1.0 - af) * 255.0) / denom), 0, 255);
                    outG = ClampInt((int)Math.Round((gr - (1.0 - af) * 255.0) / denom), 0, 255);
                    outB = ClampInt((int)Math.Round((b - (1.0 - af) * 255.0) / denom), 0, 255);
                }

                outArgb[o] = (byte)outB;
                outArgb[o + 1] = (byte)outG;
                outArgb[o + 2] = (byte)outR;
                outArgb[o + 3] = a;
            }

            // 3. Componentes conexos (8-vizinhos) para isolar exatamente os 12 corpos principais + seus satélites
            int[] labels = new int[total];
            var comps = new List<Comp>();
            var cq = new Queue<int>(2048);
            int curId = 0;

            for (int i = 0; i < total; i++) {
                if (labels[i] != 0 || outArgb[i * 4 + 3] < 24) continue;
                curId++;
                var comp = new Comp { Id = curId };
                labels[i] = curId;
                cq.Enqueue(i);

                while (cq.Count > 0) {
                    int p = cq.Dequeue();
                    int px = p % w, py = p / w;
                    comp.Area++;
                    comp.SumX += px;
                    comp.SumY += py;
                    if (px < comp.MinX) comp.MinX = px;
                    if (px > comp.MaxX) comp.MaxX = px;
                    if (py < comp.MinY) comp.MinY = py;
                    if (py > comp.MaxY) comp.MaxY = py;
                    comp.Pixels.Add(p);

                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            if (dx == 0 && dy == 0) continue;
                            int nx = px + dx, ny = py + dy;
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                            int ni = ny * w + nx;
                            if (labels[ni] == 0 && outArgb[ni * 4 + 3] >= 24) {
                                labels[ni] = curId;
                                cq.Enqueue(ni);
                            }
                        }
                    }
                }
                comps.Add(comp);
            }

            var byArea = comps.OrderByDescending(c => c.Area).ToList();
            if (byArea.Count < 12) {
                throw new Exception("Menos de 12 componentes detectados em " + inputPath + " (" + byArea.Count + ")");
            }
            var primaries = byArea.Take(12).ToList();
            int area12 = primaries[11].Area;
            int area13 = byArea.Count > 12 ? byArea[12].Area : 0;
            Console.WriteLine(string.Format("[{0}] comps={1} area12={2} area13={3}", Path.GetFileName(inputPath), comps.Count, area12, area13));

            // Mapeia cada satélite/bolha/brilho (>= 4 px) ao corpo primário mais próximo em até 62px
            var groups = new Dictionary<int, List<Comp>>();
            foreach (var p in primaries) groups[p.Id] = new List<Comp> { p };

            for (int k = 12; k < byArea.Count; k++) {
                var sat = byArea[k];
                if (sat.Area < 4) continue;
                Comp best = null;
                double bestDist = 62.0;
                double scx = sat.Cx, scy = sat.Cy;
                foreach (var pri in primaries) {
                    double dx = scx < pri.MinX ? pri.MinX - scx : (scx > pri.MaxX ? scx - pri.MaxX : 0.0);
                    double dy = scy < pri.MinY ? pri.MinY - scy : (scy > pri.MaxY ? scy - pri.MaxY : 0.0);
                    double d = Math.Sqrt(dx * dx + dy * dy);
                    if (d < bestDist) {
                        bestDist = d;
                        best = pri;
                    }
                }
                if (best != null) {
                    groups[best.Id].Add(sat);
                }
            }

            // Ordena os 12 grupos em 3 linhas de 4 colunas (top-to-bottom, left-to-right)
            var rowSorted = primaries.OrderBy(p => p.Cy).ToList();
            var ordered = new List<Comp>(12);
            for (int r = 0; r < 3; r++) {
                ordered.AddRange(rowSorted.Skip(r * 4).Take(4).OrderBy(p => p.Cx));
            }

            // 4. Salva os 12 PNGs 160x160 transparentes e compõe a folha de inspeção com fundo xadrez escuro
            int prevCols = 4, prevRows = 3, tileSize = 180;
            using (var previewBmp = new Bitmap(prevCols * tileSize, prevRows * tileSize, PixelFormat.Format32bppArgb))
            using (var pg = Graphics.FromImage(previewBmp))
            using (var font = new Font("Segoe UI", 9f, FontStyle.Bold)) {
                pg.Clear(Color.FromArgb(15, 23, 42));
                // Desenha padrão xadrez sutil para verificar transparência real
                using (var checkerBrush = new SolidBrush(Color.FromArgb(30, 41, 59))) {
                    for (int cy = 0; cy < previewBmp.Height; cy += 15) {
                        for (int cx = 0; cx < previewBmp.Width; cx += 15) {
                            if (((cx / 15) + (cy / 15)) % 2 == 0) {
                                pg.FillRectangle(checkerBrush, cx, cy, 15, 15);
                            }
                        }
                    }
                }

                for (int idx = 0; idx < 12; idx++) {
                    var pri = ordered[idx];
                    var members = groups[pri.Id];
                    int minX = w, minY = h, maxX = 0, maxY = 0;
                    foreach (var m in members) {
                        if (m.MinX < minX) minX = m.MinX;
                        if (m.MinY < minY) minY = m.MinY;
                        if (m.MaxX > maxX) maxX = m.MaxX;
                        if (m.MaxY > maxY) maxY = m.MaxY;
                    }
                    int cropW = Math.Max(1, maxX - minX + 1);
                    int cropH = Math.Max(1, maxY - minY + 1);

                    using (var cropBmp = new Bitmap(cropW, cropH, PixelFormat.Format32bppArgb)) {
                        var cbd = cropBmp.LockBits(new Rectangle(0, 0, cropW, cropH), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                        byte[] cropBuf = new byte[cropW * cropH * 4];
                        foreach (var m in members) {
                            foreach (int pi in m.Pixels) {
                                int px = pi % w, py = pi / w;
                                int tx = px - minX, ty = py - minY;
                                int so = pi * 4;
                                int to = (ty * cropW + tx) * 4;
                                cropBuf[to] = outArgb[so];
                                cropBuf[to + 1] = outArgb[so + 1];
                                cropBuf[to + 2] = outArgb[so + 2];
                                cropBuf[to + 3] = outArgb[so + 3];
                            }
                        }
                        Marshal.Copy(cropBuf, 0, cbd.Scan0, cropBuf.Length);
                        cropBmp.UnlockBits(cbd);

                        int outSize = 160;
                        double innerMax = 144.0;
                        double scale = Math.Min(innerMax / cropW, innerMax / cropH);
                        int drawW = Math.Max(1, (int)Math.Round(cropW * scale));
                        int drawH = Math.Max(1, (int)Math.Round(cropH * scale));
                        int drawX = (outSize - drawW) / 2;
                        int drawY = (outSize - drawH) / 2;

                        using (var iconBmp = new Bitmap(outSize, outSize, PixelFormat.Format32bppArgb))
                        using (var ig = Graphics.FromImage(iconBmp)) {
                            ig.Clear(Color.Transparent);
                            ig.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            ig.SmoothingMode = SmoothingMode.HighQuality;
                            ig.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            ig.DrawImage(cropBmp, new Rectangle(drawX, drawY, drawW, drawH));

                            string outPath = Path.Combine(outDir, names12[idx] + ".png");
                            iconBmp.Save(outPath, ImageFormat.Png);

                            int col = idx % 4;
                            int row = idx / 4;
                            int tx0 = col * tileSize;
                            int ty0 = row * tileSize;
                            pg.DrawImage(iconBmp, tx0 + 10, ty0 + 4, 152, 152);
                            pg.DrawRectangle(Pens.DarkCyan, tx0, ty0, tileSize - 1, tileSize - 1);
                            pg.DrawString(names12[idx], font, Brushes.Cyan, tx0 + 4, ty0 + tileSize - 19);
                        }
                    }
                }
                previewBmp.Save(previewPath, ImageFormat.Png);
            }
        }
    }

    private static double Clamp(double v, double lo, double hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    private static int ClampInt(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Drawing

$srcDir = "C:\Users\Dani\.gemini\antigravity\brain\f5a3413a-c42d-4c86-b4ac-a89167d28d54\.user_uploaded"
$fishDir = Join-Path $OutBaseDir "fish"
$baitsDir = Join-Path $OutBaseDir "baits"
$rodsDir = Join-Path $OutBaseDir "rods"

# 1. Peixes Sheet 1
[FishingAssetExtractor]::ProcessSheet(
  (Join-Path $srcDir "media_1795664050351_4c533d74.jpg"),
  $fishDir,
  (Join-Path $PreviewDir "preview_sheet_1_fish1.png"),
  @(
    "fish_mahi_mahi", "fish_acara_disco", "fish_idolo_mouro", "fish_piranha_vermelha",
    "fish_barbo_tigre", "fish_espadinha_rubra", "fish_atum_azul", "fish_peixe_leao",
    "fish_peixe_vela", "fish_pirarucu", "fish_linguado", "fish_salmao_prateado"
  ),
  $false
)

# 2. Peixes Sheet 2
[FishingAssetExtractor]::ProcessSheet(
  (Join-Path $srcDir "media_1795664050419_f3968807.jpg"),
  $fishDir,
  (Join-Path $PreviewDir "preview_sheet_2_fish2.png"),
  @(
    "fish_kinguio", "fish_carpa_koi", "fish_peixe_palhaco", "fish_bagre_cinza",
    "fish_truta_arco_iris", "fish_betta_real", "fish_acara_bandeira", "fish_guppy_arco_iris",
    "fish_tilapia", "fish_cirurgiao_azul", "fish_baiacu_espinho", "fish_cirurgiao_amarelo"
  ),
  $false
)

# 3. Peixes Sheet 3
[FishingAssetExtractor]::ProcessSheet(
  (Join-Path $srcDir "media_1795664050483_6ddd5acd.jpg"),
  $fishDir,
  (Join-Path $PreviewDir "preview_sheet_3_fish3.png"),
  @(
    "fish_tetra_neon", "fish_oscar_tigre", "fish_barracuda", "fish_esturjao_ancestral",
    "fish_peixe_borboleta", "fish_pargo_vermelho", "fish_peixe_voador", "fish_peixe_agulha",
    "fish_cascudo_leopardo", "fish_peixe_mandarim", "fish_peixe_arqueiro", "fish_sardinha"
  ),
  $false
)

# 4. Iscas
[FishingAssetExtractor]::ProcessSheet(
  (Join-Path $srcDir "media_1795664050384_c0f9e1d7.jpg"),
  $baitsDir,
  (Join-Path $PreviewDir "preview_sheet_4_baits.png"),
  @(
    "bait_plug_vermelho", "bait_popper_dourado", "bait_spinnerbait_dupla", "bait_jig_grub",
    "bait_minhoca_silicone", "bait_minhoca_viva", "bait_camarao_vivo", "bait_mosca_artesanal",
    "bait_colher_metalica", "bait_sapo_artificial", "bait_peixinho_vivo", "bait_gafanhoto"
  ),
  $true
)

# 5. Varas
[FishingAssetExtractor]::ProcessSheet(
  (Join-Path $srcDir "media_1795664050456_c23c622e.jpg"),
  $rodsDir,
  (Join-Path $PreviewDir "preview_sheet_5_rods.png"),
  @(
    "rod_7_bambu_trancado", "rod_8_fibra_carmesim", "rod_9_tatica_grafite", "rod_10_guardiao_floresta",
    "rod_11_mares_escamadas", "rod_12_druidica_raiz", "rod_13_cronomecanica", "rod_14_glacial_cristal",
    "rod_15_dragao_infernal", "rod_16_abissal_leviata", "rod_17_celestial_serafim", "rod_18_cosmica_veu_astral"
  ),
  $true
)

Write-Output "DONE: 60 PNGs gerados em $OutBaseDir e 5 previews em $PreviewDir"
