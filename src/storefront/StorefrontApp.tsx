import React, { useState, useEffect } from 'react';
import './storefront.css';
import { StoreProvider, useStore } from './context/StoreContext';
import { StoreHeader } from './components/StoreHeader';
import { StoreFooter } from './components/StoreFooter';
import { ServiceAreaModal } from './components/ServiceAreaModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { SangoubAuthModal } from './components/SangoubAuthModal';
import { OrderTrackingModal, type TrackableOrder } from './components/OrderTrackingModal';
import { HomePage } from './pages/HomePage';
import { MobileStorefront } from './mobile/MobileStorefront';
import { LAUNCH_CONFIG } from '../config/launchConfig';

/**
 * Hook to detect viewport width changes in real time
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

const StorefrontRouter: React.FC = () => {
  const { currentPath, navigate, cartItems, serviceArea } = useStore();
  const [areaModalOpen, setAreaModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('sangoub_location_confirmed');
  });
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<TrackableOrder | null>(() => {
    try {
      const saved = localStorage.getItem('sangoub_last_order');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = 'سنجوب | Sangoub';
  }, []);

  // React to URL route changes
  useEffect(() => {
    if (currentPath === '/cart') {
      setCartModalOpen(true);
    } else if (
      currentPath === '/login' ||
      currentPath === '/register' ||
      currentPath === '/account' ||
      currentPath === '/profile'
    ) {
      setRegisterModalOpen(true);
    } else if (currentPath === '/track' || currentPath.startsWith('/order-tracking')) {
      if (!activeOrder) {
        // Sample order for demo / preview if none placed yet
        const demoOrder: TrackableOrder = {
          orderId: 'SNG-849201',
          itemsCount: 3,
          total: 185,
          destination: serviceArea.name || 'شارع المهندس ابراهيم عثمان، الشروق',
          destinationCoords: {
            lat: serviceArea.latitude || 30.1258,
            lng: serviceArea.longitude || 31.6033,
          },
          time: LAUNCH_CONFIG.showEta ? '15-25 دقيقة' : '',
          paymentMethod: 'instapay',
          notes: 'يرجى الاتصال عند الوصول',
          items: [
            { name: 'وجبة إفطار سنجوب المميزة', quantity: 2, price: 65 },
            { name: 'عصير برتقال طازج', quantity: 1, price: 55 },
          ],
          createdAt: 'الآن',
        };
        setActiveOrder(demoOrder);
      }
      setTrackingModalOpen(true);
    }
  }, [currentPath, activeOrder, serviceArea.name, serviceArea.latitude, serviceArea.longitude]);

  const handleOrderPlaced = (order: TrackableOrder) => {
    setActiveOrder(order);
    try {
      localStorage.setItem('sangoub_last_order', JSON.stringify(order));
    } catch {}
    setTrackingModalOpen(true);
  };

  return (
    <div className="sangoub-store min-h-screen bg-[#F7F7F8]" dir="rtl">
      {/* 1. PURE MOBILE-FIRST EXPERIENCE (Dedicated for Mobile Screens < 768px) */}
      {isMobile ? (
        <MobileStorefront
          onOpenAreaModal={() => setAreaModalOpen(true)}
          onOpenCartModal={() => setCartModalOpen(true)}
          onOpenRegisterModal={() => setRegisterModalOpen(true)}
          onOpenTrackingModal={() => setTrackingModalOpen(true)}
          activeOrder={activeOrder}
        />
      ) : (
        /* 2. DESKTOP EXPERIENCE (For Tablets & Laptops >= 768px) */
        <div className="flex flex-col min-h-screen">
          <StoreHeader
            onOpenAreaModal={() => setAreaModalOpen(true)}
            onOpenTrackingModal={() => setTrackingModalOpen(true)}
            hasActiveOrder={Boolean(activeOrder)}
          />
          <main className="flex-1">
            <HomePage onOpenAreaModal={() => setAreaModalOpen(true)} />
          </main>
          <StoreFooter />
        </div>
      )}

      {/* Global Modals */}

      {/* 1. Delivery Address Selector Modal */}
      <ServiceAreaModal
        isOpen={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
      />

      {/* 2. Cart & Order Checkout Modal */}
      <CartCheckoutModal
        isOpen={cartModalOpen}
        onClose={() => {
          setCartModalOpen(false);
          if (currentPath === '/cart') navigate('/');
        }}
        onRequestRegister={() => {
          setCartModalOpen(false);
          setRegisterModalOpen(true);
        }}
        onOpenAreaModal={() => {
          setCartModalOpen(false);
          setAreaModalOpen(true);
        }}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* 3. Sangoub Authentication & Profile Modal */}
      <SangoubAuthModal
        isOpen={registerModalOpen}
        onClose={() => {
          setRegisterModalOpen(false);
          if (
            currentPath === '/login' ||
            currentPath === '/register' ||
            currentPath === '/account' ||
            currentPath === '/profile'
          ) {
            navigate('/');
          }
        }}
        onSuccess={() => {
          setRegisterModalOpen(false);
          if (cartItems.length > 0) {
            setCartModalOpen(true);
          }
        }}
      />

      {/* 4. Live Talabat-Style Order Tracking Modal (With Leaflet Map & Motorcycle Mascot) */}
      <OrderTrackingModal
        isOpen={trackingModalOpen}
        onClose={() => {
          setTrackingModalOpen(false);
          if (currentPath === '/track' || currentPath.startsWith('/order-tracking')) {
            navigate('/');
          }
        }}
        order={activeOrder}
      />
    </div>
  );
};

export default function StorefrontApp() {
  return (
    <StoreProvider>
      <StorefrontRouter />
    </StoreProvider>
  );
}
