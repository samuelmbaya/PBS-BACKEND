import React, { useState } from 'react';
import './Delivery.css';
import { useNavigate } from 'react-router-dom';

const Delivery = ({ onDeliveryData }) => {
  const navigate = useNavigate();

  const [deliveryData, setDeliveryData] = useState({
    country: '',
    name: '',
    lastName: '',
    streetAddress: '',
    apartment: '',
    postalCode: '',
    city: '',
    province: '',
    phoneNumber: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDeliveryData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (onDeliveryData) {
      onDeliveryData({
        ...deliveryData,
        [name]: value
      });
    }
  };

  const handleContinueToPayment = () => {
    const requiredFields = [
      'country',
      'name',
      'lastName',
      'streetAddress',
      'city',
      'province',
      'phoneNumber'
    ];
    const missingFields = requiredFields.filter(field => !deliveryData[field]);
    
    if (missingFields.length > 0) {
      alert('Please fill in all required fields');
      return;
    }

    if (onDeliveryData) {
      onDeliveryData(deliveryData, true);
    }

    navigate('/payment');
  };

  return (
    <div className="delivery-section dark">
      <div className="delivery-header">
        <h2>Delivery</h2>
      </div>
      
      <div className="shipping-address">
        <h3>Shipping Address</h3>
        
        <div className="form-group">
          <input
            type="text"
            name="country"
            placeholder="Country/Region"
            value={deliveryData.country}
            onChange={handleInputChange}
            className="form-input full-width"
          />
        </div>

        <div className="form-row">
          <div className="form-group half-width">
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={deliveryData.name}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
          <div className="form-group half-width">
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={deliveryData.lastName}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <input
            type="text"
            name="streetAddress"
            placeholder="Street and house number"
            value={deliveryData.streetAddress}
            onChange={handleInputChange}
            className="form-input full-width"
          />
        </div>

        <div className="form-group">
          <input
            type="text"
            name="apartment"
            placeholder="Apartment, suite, etc. (optional)"
            value={deliveryData.apartment}
            onChange={handleInputChange}
            className="form-input full-width"
          />
        </div>

        <div className="form-row three-cols">
          <div className="form-group">
            <input
              type="text"
              name="postalCode"
              placeholder="Postal Code"
              value={deliveryData.postalCode}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="city"
              placeholder="City"
              value={deliveryData.city}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="province"
              placeholder="Province"
              value={deliveryData.province}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <input
            type="tel"
            name="phoneNumber"
            placeholder="Phone Number"
            value={deliveryData.phoneNumber}
            onChange={handleInputChange}
            className="form-input full-width"
          />
        </div>

        <div className="return-to-cart">
          <a href="/cart" className="return-link">← Return to Cart</a>
        </div>
      </div>

      <div className="continue-section">
        <button 
          className="continue-btn"
          onClick={handleContinueToPayment}
        >
          Continue To Payment
        </button>
      </div>
    </div>
  );
};

export default Delivery;
