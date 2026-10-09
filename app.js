const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

let historyData = []; // Menyimpan cache data untuk ekspor Excel

function showView(name) {
  $("view-loading").classList.toggle("hidden", name !== "loading");
  $("view-login").classList.toggle("hidden", name !== "login");
  $("view-main").classList.toggle("hidden", name !== "main");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 3000);
}

/* ================= AUTENTIKASI (LOGIN & LOGOUT) ================= */

async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    $("user-info").textContent = data.session.user.email;
    showView("main");
    loadHistory();
  } else {
    showView("login");
  }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("login-btn");
  const msg = $("login-error");

  msg.textContent = "";
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value,
    password: $("password").value
  });

  btn.disabled = false;
  btn.textContent = "Masuk";

  if (error) {
    msg.textContent = error.message.includes("Invalid login credentials")
      ? "Email atau password salah."
      : "Gagal masuk: " + error.message;
  } else {
    checkSession();
  }
});

$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  $("password").value = "";
  checkSession();
});

/* ================= INPUT 7 DIGIT METERAN ================= */

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

/* ================= MUAT DATA & KELOLA DATA ================= */

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

  historyData = data || [];

  if (historyData.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#6b7280;">Belum ada catatan meteran.</td></tr>`;
    return;
  }

  body.innerHTML = historyData.map((d) => {
    const waktu = new Date(d.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    const angkaCombined = `${d.angka_1}${d.angka_2}${d.angka_3}${d.angka_4}${d.angka_5}${d.angka_6}${d.angka_7}`;
    
    return `
      <tr>
        <td><small>${waktu}</small></td>
        <td>
          ${d.foto_url ? `<a href="${d.foto_url}" target="_blank"><img src="${d.foto_url}" class="img-thumb" alt="Foto"></a>` : '-'}
        </td>
        <td><span class="digit-badge">${angkaCombined}</span> m³</td>
        <td><small>${d.keterangan || '-'}</small></td>
      </tr>
    `;
  }).join("");
}

// Simpan Data Meteran Baru
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

    // Upload ke Storage
    const { error: uploadError } = await sb.storage
      .from("produksi-foto")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Ambil Public URL
    const { data: urlData } = sb.storage
      .from("produksi-foto")
      .getPublicUrl(filePath);

    // Insert ke Database
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

/* ================= FITUR EKSPOR EXCEL ================= */

$("export-excel-btn").addEventListener("click", () => {
  if (!historyData || historyData.length === 0) {
    alert("Belum ada data untuk diekspor!");
    return;
  }

  const excelRows = [
    ["No", "Waktu Pencatatan", "Angka Meteran (m³)", "Keterangan", "Link Foto Bukti"]
  ];

  historyData.forEach((d, i) => {
    const waktu = new Date(d.created_at).toLocaleString("id-ID");
    const angkaCombined = `${d.angka_1}${d.angka_2}${d.angka_3}${d.angka_4}${d.angka_5}${d.angka_6}${d.angka_7}`;
    
    excelRows.push([
      i + 1,
      waktu,
      angkaCombined,
      d.keterangan || "-",
      d.foto_url || "-"
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(excelRows);
  ws["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Meteran Air");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Laporan_Meteran_Air_${dateStr}.xlsx`);
  toast("File Excel diunduh!");
});

/* ================= INISIALISASI ================= */
checkSession();
