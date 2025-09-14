import React, { useState, useEffect } from "react";
import "./ProductPage.css";
import { useNavigate } from "react-router-dom";

const ProductPage = () => {
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const navigate = useNavigate();

  // Check authentication and load user data
  useEffect(() => {
    const checkAuthAndLoadUserData = () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedIsLoggedIn = localStorage.getItem("isLoggedIn");

        if (storedUser && storedIsLoggedIn === "true") {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setIsAuthenticated(true);
          loadUserSpecificData(parsedUser.email);
        } else {
          navigate("/");
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        navigate("/");
      }
    };

    const loadUserSpecificData = (userEmail) => {
      try {
        const userCart = JSON.parse(localStorage.getItem(`cart_${userEmail}`) || "[]");
        setCart(userCart);
        const userWishlist = JSON.parse(localStorage.getItem(`wishlist_${userEmail}`) || "[]");
        setWishlist(userWishlist);
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    checkAuthAndLoadUserData();
  }, [navigate]);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("http://localhost:3000/Products");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(data.data || []);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Save cart & wishlist to localStorage
  useEffect(() => {
    if (currentUser?.email) {
      localStorage.setItem(`cart_${currentUser.email}`, JSON.stringify(cart));
      localStorage.setItem(`wishlist_${currentUser.email}`, JSON.stringify(wishlist));
    }
  }, [cart, wishlist, currentUser]);

  // Toggle wishlist
  const toggleWishlist = (product) => {
    if (!isAuthenticated) {
      alert("Please login to manage your wishlist");
      return;
    }
    setWishlist((prev) => {
      const exists = prev.findIndex((item) => item._id === product._id);
      if (exists !== -1) return prev.filter((item) => item._id !== product._id);
      return [...prev, { ...product, addedAt: new Date().toISOString() }];
    });
  };

  // Add to cart
  const addToCart = (product) => {
    if (!isAuthenticated) {
      alert("Please login to add items to cart");
      return;
    }
    setCart((prev) => {
      const index = prev.findIndex((item) => item._id === product._id);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          quantity: (updated[index].quantity || 1) + 1,
        };
        return updated;
      }
      return [...prev, { ...product, quantity: 1, addedAt: new Date().toISOString() }];
    });
  };

  const isInWishlist = (productId) => wishlist.some((item) => item._id === productId);
  const getCartItemCount = () => cart.reduce((total, item) => total + (item.quantity || 1), 0);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    navigate("/Home");
  };

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="homepage">
      <header className="navbar">
        <h1 className="logo" onClick={() => navigate("/Home")}>PWS Products</h1>
        <div className="searchbar">
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <nav className="nav-buttons">
          <button onClick={() => navigate("/Home")}>Home</button>
          <button onClick={() => navigate("/Wishlist")}>Wishlist ({wishlist.length})</button>
          <button onClick={() => navigate("/Cart")}>Cart ({getCartItemCount()})</button>
          <button onClick={() => navigate("/profile")}>Profile</button>
          <button onClick={() => navigate("/orders")}>Orders</button>
          {currentUser && (
            <div className="user-info">
              <span>Signed in as: {currentUser.name || currentUser.email}!</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          )}
        </nav>
      </header>

      <main className="products-container">
        {loading && <p>Loading products...</p>}
        {error && <p className="error">Error: {error}</p>}
        {!loading && !error && (
          filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div className="product-card" key={product._id}>
                <img
                  src={product.imageURL || "https://via.placeholder.com/150"}
                  alt={product.name || "Unnamed Product"}
                  className="product-img"
                />
                <h3>{product.name || "Unnamed Product"}</h3>
                <p className="price">
                  R {product.price?.toLocaleString() || "0.00"}
                </p>
                <div className="actions">
                  <button onClick={(e) => { e.stopPropagation(); addToCart(product); }} className="add-to-cart-btn">Add to Cart</button>
                  <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product); }} className={`wishlist-btn ${isInWishlist(product._id) ? "in-wishlist" : ""}`}>
                    {isInWishlist(product._id) ? "♥ Remove" : "♡ Wishlist"}
                  </button>
                </div>
                {cart.find((item) => item._id === product._id) && (
                  <div className="in-cart-indicator">In Cart (Qty: {cart.find((item) => item._id === product._id)?.quantity || 1})</div>
                )}
              </div>
            ))
          ) : <p>No products found.</p>
        )}
      </main>
    </div>
  );
};

export default ProductPage;
