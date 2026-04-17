import { Link } from 'react-router-dom';

export default function Navbar() { 
    // const token = localStorage.getItem('adminToken');
    // const logout = () => {
    //     localStorage.removeItem('adminToken');
    //     window.location.href = '/';
    // };

    return (
        <nav style={{ padding: "1rem", background: "#1e1e2f", color: "white", display: "flex", gap: "1rem" }}>
            <Link to="/" style={{ color: "white", textDecoration: "none" }}>Schedule</Link>
            {/* {token ? (
                <>
                    <Link to="/admin" style={{ color: "white", textDecoration: "none" }}>Admin Panel</Link>
                    <button onClick={logout} style={{ background: "none", border: "none", color: "white", cursor: "pointer", marginLeft: "auto" }}>
                        Logout
                    </button>
                </>
            ) : (
                <Link to="/admin/login" style={{ color: "white", textDecoration: "none", marginLeft: "auto" }}>Admin Login</Link>
            )} */}
        </nav>
    );
}