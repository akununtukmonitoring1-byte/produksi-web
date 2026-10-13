// Pastikan config.js mendefinisikan SUPABASE_URL dan SUPABASE_KEY
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM Utama
const viewLoading = document.getElementById('view-loading');
const viewLogin = document.getElementById('view-login');
const viewMain = document.getElementById('view-main');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');

const meterForm = document.getElementById('meter-form');
const meterMsg = document.getElementById('meter-msg');
const digitInputs = document.querySelectorAll('.onda-digit-input');
const meterValueInput = document.getElementById('meter-value');
const riwayatBody = document.getElementById('riwayat-body');
const exportExcelBtn = document.getElementById('export-excel-btn');
const toast = document.getElementById('toast');

// Navigasi Tab
const tabs = document.querySelectorAll('.tab');
const pages = {
  catat: document.getElementById('page-catat'),
  riwayat: document.getElementById('page-riwayat')
};

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const target = tab.getAttribute('data-page');
    Object.keys(pages).forEach(key => {
      if (key === target) {
        pages[key].classList.remove('hidden');
      } else {
        pages[key].classList.add('hidden');
      }
    });
  });
});

// Cek Sesi Saat Aplikasi Dimuat
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      showMainView(session.user);
    } else {
      showLoginView();
    }
  } catch (err) {
    console.error(err);
    showLoginView();
  }
});

function showLoginView() {
  viewLoading.classList.add('hidden');
  viewLogin.classList.remove('hidden');
  viewMain.classList.add('hidden');
}

function showMainView(user) {
  viewLoading.classList.add('hidden');
  viewLogin.classList.add('hidden');
  viewMain.classList.remove('hidden');
  
  // Menampilkan username asli (membuang domain belakang jika menggunakan format email dummy)
  const cleanEmail = user.email ? user.email.split('@')[0] : 'Petugas';
  userInfo.textContent = cleanEmail;
  loadRiwayat();
}

// Proses Login dengan Username Saja
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  
  const usernameInput = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  // Konversi username menjadi format email internal Supabase
  // Contoh: petugas1 menjadi petugas1@monitoring.local
  const fakeEmail = `${usernameInput}@monitoring.local`;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ 
    email: fakeEmail, 
    password: password 
  });

  if (error) {
    loginError.textContent = 'Gagal masuk: Username atau password salah.';
  } else {
    showMainView(data.user);
  }
});

// Proses Logout
logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLoginView();
});

// Notifikasi Toast
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Simpan Data Meteran
meterForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  meterMsg.textContent = '';
  
  const meterVal = meterValueInput.value;
  if (!meterVal || meterVal.length < 7) {
    meterMsg.textContent = 'Harap isi lengkap 7 digit angka meteran!';
    return;
  }

  const fotoFile = document.getElementById('meter-foto').files[0];
  const keterangan = document.getElementById('meter-ket').value;
  const { data: { user } } = await supabaseClient.auth.getUser();
  const petugasName = user.email ? user.email.split('@')[0] : 'Petugas';

  let fotoUrl = '';

  try {
    // 1. Upload Foto jika ada
    if (fotoFile) {
      const fileName = `${Date.now()}_${fotoFile.name}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('bukti-produksi') 
        .upload(fileName, fotoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('bukti-produksi')
        .getPublicUrl(fileName);
      
      fotoUrl = publicUrlData.publicUrl;
    }

    // 2. Simpan Data ke Tabel Database
    const { error: insertError } = await supabaseClient
      .from('pencatatan_meter')
      .insert([
        {
          nilai_meteran: meterVal,
          foto_url: fotoUrl,
          keterangan: keterangan,
          petugas: petugasName,
          created_at: new Date()
        }
      ]);

    if (insertError) throw insertError;

    showToast('Pencatatan berhasil disimpan!');
    meterForm.reset();
    digitInputs.forEach(input => input.value = '');
    meterValueInput.value = '';
    loadRiwayat();

  } catch (err) {
    meterMsg.textContent = 'Terjadi kesalahan: ' + err.message;
  }
});

// Muat Riwayat Data
async function loadRiwayat() {
  riwayatBody.innerHTML = `<tr><td colspan="5" class="empty">Memuat data...</td></tr>`;
  
  const { data, error } = await supabaseClient
    .from('pencatatan_meter')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    riwayatBody.innerHTML = `<tr><td colspan="5" class="empty" style="color: #dc2626;">Gagal memuat data.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    riwayatBody.innerHTML = `<tr><td colspan="5" class="empty">Belum ada riwayat pencatatan.</td></tr>`;
    return;
  }

  riwayatBody.innerHTML = '';
  data.forEach(item => {
    const tr = document.createElement('tr');
    const tanggal = new Date(item.created_at).toLocaleString('id-ID');
    const fotoHtml = item.foto_url 
      ? `<a href="${item.foto_url}" target="_blank"><img src="${item.foto_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"></a>` 
      : 'Tidak ada';

    tr.innerHTML = `
      <td>${tanggal}</td>
      <td><strong>${item.nilai_meteran}</strong></td>
      <td>${fotoHtml}</td>
      <td>${item.keterangan || '-'}</td>
      <td>${item.petugas || '-'}</td>
    `;
    riwayatBody.appendChild(tr);
  });
}

// Ekspor ke Excel menggunakan SheetJS
exportExcelBtn.addEventListener('click', async () => {
  const { data, error } = await supabaseClient
    .from('pencatatan_meter')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

  const excelData = data.map((item, index) => ({
    No: index + 1,
    Waktu: new Date(item.created_at).toLocaleString('id-ID'),
    'Nilai Meteran (7 Digit)': item.nilai_meteran,
    Keterangan: item.keterangan || '',
    Petugas: item.petugas || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Meteran");
  XLSX.writeFile(workbook, "Laporan_Meteran_Air_Onda.xlsx");
});
