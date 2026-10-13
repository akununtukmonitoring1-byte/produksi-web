// Pastikan config.js mendefinisikan SUPABASE_URL dan SUPABASE_KEY
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Elemen DOM Utama
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

// 2. Navigasi Tab (Perbaikan Utama Arah Halaman)
const tabBtns = document.querySelectorAll('.tab-btn');
const pageCatat = document.getElementById('page-catat');
const pageRiwayat = document.getElementById('page-riwayat');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Sembunyikan semua halaman & lepas class active
    tabBtns.forEach(b => b.classList.remove('active'));
    pageCatat.classList.add('hidden');
    pageRiwayat.classList.add('hidden');

    // Aktifkan tab yang diklik
    btn.classList.add('active');
    const targetPage = btn.getAttribute('data-page');

    if (targetPage === 'catat') {
      pageCatat.classList.remove('hidden');
    } else if (targetPage === 'riwayat') {
      pageRiwayat.classList.remove('hidden');
      loadRiwayat(); // Muat ulang data riwayat saat tab diklik
    }
  });
});

// 3. Cek Sesi Login dari LocalStorage saat Aplikasi Dimuat
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('current_user');
  if (savedUser) {
    showMainView(savedUser);
  } else {
    showLoginView();
  }
});

function showLoginView() {
  if (viewLoading) viewLoading.classList.add('hidden');
  if (viewLogin) viewLogin.classList.remove('hidden');
  if (viewMain) viewMain.classList.add('hidden');
}

function showMainView(username) {
  if (viewLoading) viewLoading.classList.add('hidden');
  if (viewLogin) viewLogin.classList.add('hidden');
  if (viewMain) viewMain.classList.remove('hidden');
  if (userInfo) userInfo.textContent = username;
  
  loadRiwayat();
}

// 4. Proses Login Berbasis Tabel 'petugas'
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value;

    try {
      const { data, error } = await supabaseClient
        .from('petugas')
        .select('*')
        .eq('username', usernameInput)
        .eq('password', passwordInput)
        .single();

      if (error || !data) {
        loginError.textContent = 'Username atau password salah!';
      } else {
        localStorage.setItem('current_user', data.username);
        showMainView(data.username);
      }
    } catch (err) {
      loginError.textContent = 'Gagal terhubung ke database.';
      console.error(err);
    }
  });
}

// 5. Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('current_user');
    showLoginView();
  });
}

// Notifikasi Toast
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 6. Simpan Data Meteran
if (meterForm) {
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
    const currentPetugas = localStorage.getItem('current_user') || 'Admin';

    let fotoUrl = '';

    try {
      // Upload Foto jika ada
      if (fotoFile) {
        const fileName = `${Date.now()}_${fotoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('produksi-foto') 
          .upload(fileName, fotoFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseClient.storage
          .from('bukti-produksi')
          .getPublicUrl(fileName);
        
        fotoUrl = publicUrlData.publicUrl;
      }

      // Simpan Data ke Database
      const { error: insertError } = await supabaseClient
        .from('pencatatan_meter')
        .insert([
          {
            nilai_meteran: meterVal,
            foto_url: fotoUrl,
            keterangan: keterangan,
            petugas: currentPetugas,
            created_at: new Date()
          }
        ]);

      if (insertError) throw insertError;

      showToast('Pencatatan berhasil disimpan!');
      meterForm.reset();
      
      // Reset 7 digit kotak input
      digitInputs.forEach(input => input.value = '');
      meterValueInput.value = '';
      
      loadRiwayat();

    } catch (err) {
      meterMsg.textContent = 'Terjadi kesalahan: ' + err.message;
    }
  });
}

// 7. Fungsi Memuat Data Riwayat
async function loadRiwayat() {
  if (!riwayatBody) return;
  riwayatBody.innerHTML = `<tr><td colspan="5" class="empty">Memuat data...</td></tr>`;
  
  try {
    const { data, error } = await supabaseClient
      .from('pencatatan_meter')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      riwayatBody.innerHTML = `<tr><td colspan="5" class="empty" style="color: #dc2626;">Gagal memuat data: ${error.message}</td></tr>`;
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
        ? `<a href="${item.foto_url}" target="_blank"><img src="${item.foto_url}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px;"></a>` 
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
  } catch (err) {
    riwayatBody.innerHTML = `<tr><td colspan="5" class="empty" style="color: #dc2626;">Kesalahan koneksi.</td></tr>`;
  }
}

// 8. Ekspor ke Excel (SheetJS)
if (exportExcelBtn) {
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
    XLSX.writeFile(workbook, "Laporan_Meteran_Air.xlsx");
  });
}
