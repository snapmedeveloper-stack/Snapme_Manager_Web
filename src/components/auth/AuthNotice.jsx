import { Avatar, Card } from '../ui';
import logo from '../../assets/logo.png';
import './auth.css';

/**
 * Layar sebelum masuk Snapme Manager (login, akun studio, belum punya akses, gagal memeriksa akun), senada dengan
 * AuthScreen Snapme_Desktop: logo, ikon keadaan (opsional), judul, penjelasan, akun yang sedang login, langkah yang
 * bisa dilakukan, tombol, lalu isi tambahan (children). tone: 'accent' | 'warning' | 'danger'. steps: [{ title, text }]. children: isi tambahan.
 */
export default function AuthNotice({
  icon: Icon,
  tone = 'accent',
  title,
  description,
  user,
  steps = [],
  actions,
  children,
}) {
  return (
    <main className="screen-center">
      <Card className="auth-card">
        <img src={logo} alt="Snap Me" className="auth-logo" />
        {Icon && (
          <div className={`auth-icon auth-icon-${tone}`} aria-hidden="true">
            <Icon size={28} />
          </div>
        )}
        <h1 className="auth-title">{title}</h1>
        {description && <p className="auth-description">{description}</p>}
        {user && (
          <div className="auth-account">
            <Avatar src={user.photoURL} name={user.displayName || user.email} size={28} />
            <span className="auth-account-text">
              <span className="auth-account-label">Masuk sebagai</span>
              <span className="auth-account-email">{user.email}</span>
            </span>
          </div>
        )}
        {steps.length > 0 && (
          <ol className="auth-steps">
            {steps.map((step, i) => (
              <li key={step.title} className="auth-step">
                <span className="auth-step-number num">{i + 1}</span>
                <span className="auth-step-body">
                  <span className="auth-step-title">{step.title}</span>
                  <span className="auth-step-text">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {actions && <div className="auth-actions">{actions}</div>}
        {children}
      </Card>
    </main>
  );
}
