const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 3000);
}

// Muat riwayat laporan
async function loadHistory() {
  const body = $("history-body");
  const { data, error } = await sb
    .from("hasil_produksi")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    body.innerHTML = `<tr><td colspan="4" class="error">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#6b7280;">Belum ada data produksi.</td></tr>`;
    return;
  }

  body.innerHTML = data.map((d) => {
    const waktu = new Date(d.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    const angkaList = `1: ${d.angka_1} | 2: ${d.angka_2} | 3: ${d.angka_3} | 4: ${d.angka_4} | 5: ${d.angka_5} | 6: ${d.angka_6} | 7: ${d.angka_7}`;
    
    return `
      <tr>
        <td>${waktu}</td>
        <td>
          ${d.foto_url ? `<a href="${d.foto_url}" target="_blank"><img src="${d.foto_url}" class="img-thumb" alt="Foto"></a>` : '-'}
        </td>
        <td><small>${angkaList}</small></td>
        <td>${d.keterangan || '-'}</td>
      </tr>
    `;
  }).join("");
}

// Submit Form
$("prod-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("save-btn");
  const msg = $("form-msg");
  const fileInput = $("p-foto");

  msg.textContent = "";

  if (!fileInput.files || fileInput.files.length === 0) {
    msg.textContent = "Lampirkan foto terlebih dahulu.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Mengunggah foto & menyimpan...";

  try {
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `produksi/${fileName}`;

    // 1. Upload ke Supabase Storage
    const { error: uploadError } = await sb.storage
      .from("produksi-foto")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Dapatkan URL foto
    const { data: urlData } = sb.storage
      .from("produksi-foto")
      .getPublicUrl(filePath);

    // 3. Simpan data ke tabel hasil_produksi
    const { error: dbError } = await sb.from("hasil_produksi").insert({
      angka_1: Number($("a1").value),
      angka_2: Number($("a2").value),
      angka_3: Number($("a3").value),
      angka_4: Number($("a4").value),
      angka_5: Number($("a5").value),
      angka_6: Number($("a6").value),
      angka_7: Number($("a7").value),
      keterangan: $("p-ket").value.trim() || null,
      foto_url: urlData.publicUrl
    });

    if (dbError) throw dbError;

    toast("Data produksi berhasil disimpan!");
    $("prod-form").reset();
    loadHistory();

  } catch (err) {
    msg.textContent = "Gagal menyimpan: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Hasil Produksi";
  }
});

// Jalankan saat pertama dimuat
loadHistory();