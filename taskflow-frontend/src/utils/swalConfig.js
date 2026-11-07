import Swal from 'sweetalert2';

// Premium theme-aware SweetAlert configuration
const swalConfig = Swal.mixin({
  customClass: {
    popup: 'custom-swal-popup',
    title: 'custom-swal-title',
    htmlContainer: 'custom-swal-html',
    confirmButton: 'swal-btn-confirm',
    cancelButton: 'swal-btn-cancel',
    actions: 'swal-custom-actions',
    icon: 'swal-custom-icon'
  },
  buttonsStyling: false,
  backdrop: 'rgba(15, 23, 42, 0.45)',
  showClass: {
    popup: 'swal2-show'
  },
  hideClass: {
    popup: 'swal2-hide'
  }
});

export default swalConfig;
