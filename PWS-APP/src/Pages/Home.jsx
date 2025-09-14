import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

const Home = () => {
  return (
    <div className="home-container">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="logo">PBS Electrical Solutions</div>
        <div className="nav-links">
          <Link to="/ProductPage" className="nav-btn">Products</Link>
          <Link to="/Wishlist" className="nav-btn">Wishlist</Link>
          <Link to="/Cart" className="nav-btn">Cart</Link>
          <Link to="/profile" className="nav-btn">Profile</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>SOUTH AFRICAN ENERGY SUPPLIERS</h1>
          <p>
            <strong>Powered By Samuel</strong> is a company that provides
            affordable and clean energy solutions to homes and businesses in
            South Africa. We focus on using solar panels with battery storage
            and wind turbines to help reduce the effect of power outages and
            lower energy costs. Our goal is to provide reliable, eco-friendly
            energy products that help save money and protect the environment. At{" "}
            <strong>Powered By Samuel</strong>, we aim to make energy more
            affordable for everyone, create jobs, and support a cleaner, greener
            future for South Africa.
          </p>

          <Link to="/ProductPage">
            <button className="shop-btn">SHOP NOW</button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Powered By Samuel. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Home;
