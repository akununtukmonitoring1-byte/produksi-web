const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 3000);
}

// Otomatis pindah fokus ke kotak berikutnya saat mengetik angka
const digitInputs = [ $("d1"), $("d2"), $("d3"), $("d4"), $("d5"), $("d6"), $("d7") ];

digitInputs.forEach((input, idx) => {
  input.addEventListener("input", (e) => {
    const val = e.target.value;
    if (val && !/^[0-9]$/.test(val)) {
      e.target.value = "";
      return;
    }
    if (val && idx < digitInputs.length - 1) {
      digitInputs[idx + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && idx > 0) {
      digitInputs[idx - 1].focus();
    }
  });
});

// Load Riwayat
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
    body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#6b7280;">Belum ada catatan meteran.</td></tr>`;
    return;
  }

  body.innerHTML = data.map((d) => {
    const waktu = new Date(d.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    const angkaCombined = `${d.angka_1}${d.angka_2}${d.angka_3}${d.angka_4}${d.angka_5}${d.angka_6}${d.angka_7}`;
    
    return `
      <tr>
        <td><small>${waktu}</small></td>
        <td>
          ${d.foto_url ? `<a href="${d.foto_url}" target="_blank"><img src="${d.foto_url}" class="img-thumb" alt="Foto Meteran"></a>` : '-'}
        </td>
        <td><span class="digit-badge">${angkaCombined}</span> m³</td>
        <td><small>${d.keterangan || '-'}</small></td>
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
    msg.textContent = "Lampirkan foto meteran terlebih dahulu.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Mengunggah foto & menyimpan...";

  try {
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `meteran/${fileName}`;

    // 1. Upload ke Supabase Storage
    const { error: uploadError } = await sb.storage
      .from("produksi-foto")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Ambil URL foto
    const { data: urlData } = sb.storage
      .from("produksi-foto")
      .getPublicUrl(filePath);

    // 3. Simpan data 7 digit angka ke database
    const { error: dbError } = await sb.from("hasil_produksi").insert({
      angka_1: Number($("d1").value),
      angka_2: Number($("d2").value),
      angka_3: Number($("d3").value),
      angka_4: Number($("d4").value),
      angka_5: Number($("d5").value),
      angka_6: Number($("d6").value),
      angka_7: Number($("d7").value),
      keterangan: $("p-ket").value.trim() || null,
      foto_url: urlData.publicUrl
    });

    if (dbError) throw dbError;

    toast("Data meteran berhasil disimpan!");
    $("prod-form").reset();
    digitInputs[0].focus();
    loadHistory();

  } catch (err) {
    msg.textContent = "Gagal menyimpan: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Data Meteran";
  }
});

// Jalankan saat halaman dibuka
loadHistory();
