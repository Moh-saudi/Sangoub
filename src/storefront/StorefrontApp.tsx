import React, { useState, useEffect } from 'react';
import './storefront.css';
import { StoreProvider, useStore } from './context/StoreContext';
import { StoreHeader } from './components/StoreHeader';
import { StoreFooter } from './components/StoreFooter';
import { ServiceAreaModal } from './components/ServiceAreaModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { SwitchStoreModal } from './components/SwitchStoreModal';
import { SangoubAuthModal } from './components/SangoubAuthModal';
import { OrderTrackingModal, type TrackableOrder } from './components/OrderTrackingModal';
import { NotificationsModal } from './components/NotificationsModal';
import { HomePage } from './pages/HomePage';
import { MobileStorefront } from './mobile/MobileStorefront';
import { StoresPage } from './pages/StoresPage';
import { StoreDetailsPage } from './pages/StoreDetailsPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { OrdersPage } from './pages/OrdersPage';
import { AccountPage } from './pages/AccountPage';
import { LAUNCH_CONFIG } from '../config/launchConfig';
import { enableWebPushNotifications } from '../lib/webPushNotifications';
import { supabase } from '../lib/supabase';

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
  const { currentPath, navigate, cartItems, serviceArea, catalogError, user, isNotificationsModalOpen, setIsNotificationsModalOpen } = useStore();
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<TrackableOrder | null>(() => {
    try {
      const saved = localStorage.getItem('sangoub_last_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.orderStatus !== 'delivered' && parsed.orderStatus !== 'cancelled') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // Clear active order tracking bar immediately upon sign out or for guest visitors
  useEffect(() => {
    if (!user || user.isGuest) {
      setActiveOrder(null);
      setTrackingModalOpen(false);
      try {
        localStorage.removeItem('sangoub_last_order');
      } catch {}
    }
  }, [user?.id, user?.isGuest]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      setActiveOrder(null);
      setTrackingModalOpen(false);
      try {
        localStorage.removeItem('sangoub_last_order');
      } catch {}
    };
    window.addEventListener('sangoub:logged_out', handleLogoutEvent);
    return () => window.removeEventListener('sangoub:logged_out', handleLogoutEvent);
  }, []);

  // Verify and sync live status of activeOrder with Supabase (dismisses banner if delivered/cancelled)
  useEffect(() => {
    if (!activeOrder?.orderId) return;
    const rawId = activeOrder.orderId.replace(/^(ord-|order-)/i, '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    const checkLiveStatus = async () => {
      try {
        let query = supabase.from('orders').select('id, status, payment_status, order_number');
        if (isUuid) {
          query = query.eq('id', rawId);
        } else {
          query = query.or(`order_number.eq.${rawId},client_request_id.eq.${rawId}`);
        }
        const { data } = await query.maybeSingle();
        if (data?.status) {
          if (data.status === 'delivered' || data.status === 'cancelled') {
            setActiveOrder((prev) => prev ? { ...prev, orderStatus: data.status as any } : null);
            try {
              const last = localStorage.getItem('sangoub_last_order');
              if (last) {
                const parsed = JSON.parse(last);
                parsed.orderStatus = data.status;
                localStorage.setItem('sangoub_last_order', JSON.stringify(parsed));
              }
            } catch {}
          } else if (data.status !== activeOrder.orderStatus) {
            setActiveOrder((prev) => prev ? { ...prev, orderStatus: data.status as any } : null);
          }
        }
      } catch {}
    };

    void checkLiveStatus();

    const handleOrderUpdated = (e: any) => {
      const detail = e.detail;
      if (detail && (detail.orderId === activeOrder.orderId || detail.orderId === rawId)) {
        if (detail.status === 'delivered' || detail.status === 'cancelled') {
          setActiveOrder((prev) => prev ? { ...prev, orderStatus: detail.status } : null);
        } else if (detail.status) {
          setActiveOrder((prev) => prev ? { ...prev, orderStatus: detail.status } : null);
        }
      }
    };

    window.addEventListener('sangoub:order_updated', handleOrderUpdated);
    return () => window.removeEventListener('sangoub:order_updated', handleOrderUpdated);
  }, [activeOrder?.orderId]);

  const isMobile = useIsMobile();
  const isStoresList = currentPath === '/stores';
  const isSingleStore = currentPath.startsWith('/stores/');
  const isSingleProduct = currentPath.startsWith('/products/') || currentPath.startsWith('/product/');
  const isOrdersPage = currentPath === '/my-orders' || currentPath === '/orders' || currentPath === '/track';
  const isAccountPage = currentPath === '/account' || currentPath === '/profile' || currentPath === '/settings' || currentPath === '/addresses';
  const currentStoreId = isSingleStore ? decodeURIComponent(currentPath.replace(/^\/stores\//, '').replace(/\/$/, '')) : '';
  const currentProductId = isSingleProduct ? decodeURIComponent(currentPath.replace(/^\/(products|product)\//, '').replace(/\/$/, '')) : '';

  useEffect(() => {
    document.title = 'سنجوب | Sangoub';
  }, []);

  useEffect(() => {
    if (!user || user.isGuest || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void enableWebPushNotifications().catch((error) => {
      console.warn('Web push token sync failed:', error);
    });
  }, [user?.id, user?.isGuest]);

  // React to URL route changes
  useEffect(() => {
    if (currentPath === '/cart') {
      setCartModalOpen(true);
    } else if (
      currentPath === '/login' ||
      currentPath === '/register'
    ) {
      setRegisterModalOpen(true);
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
      {catalogError&&<div role="alert" className="p-3 bg-amber-50 text-amber-900 text-center">{catalogError}<button className="underline mx-2" onClick={()=>location.reload()}>إعادة المحاولة</button></div>}
      {/* 1. PURE MOBILE-FIRST EXPERIENCE (Dedicated for Mobile Screens < 768px) */}
      {isMobile ? (
        <MobileStorefront
          onOpenAreaModal={() => setAreaModalOpen(true)}
          onOpenCartModal={() => setCartModalOpen(true)}
          onOpenRegisterModal={() => setRegisterModalOpen(true)}
          onOpenTrackingModal={(ord) => {
            if (ord) {
              setActiveOrder(ord);
              setTrackingModalOpen(true);
            } else if (activeOrder) {
              setTrackingModalOpen(true);
            } else {
              navigate('/my-orders');
            }
          }}
          activeOrder={activeOrder}
        />
      ) : (
        /* 2. DESKTOP EXPERIENCE (For Tablets & Laptops >= 768px) */
        <div className="flex flex-col min-h-screen">
          <StoreHeader
            onOpenAreaModal={() => setAreaModalOpen(true)}
            onOpenTrackingModal={() => {
              if (activeOrder) {
                setTrackingModalOpen(true);
              } else {
                navigate('/my-orders');
              }
            }}
            hasActiveOrder={Boolean(user && !user.isGuest && activeOrder && activeOrder.orderStatus !== 'delivered' && activeOrder.orderStatus !== 'cancelled')}
          />
          <main className="flex-1">
            {isSingleProduct ? (
              <ProductDetailsPage
                productId={currentProductId}
                onBack={() => navigate('/')}
              />
            ) : isSingleStore ? (
              <StoreDetailsPage
                storeId={currentStoreId}
                onBackToStores={() => navigate('/stores')}
              />
            ) : isStoresList ? (
              <StoresPage onBackToHome={() => navigate('/')} />
            ) : isOrdersPage ? (
              <OrdersPage
                onBackToHome={() => navigate('/')}
                onTrackOrder={(ord) => {
                  setActiveOrder(ord);
                  setTrackingModalOpen(true);
                }}
              />
            ) : isAccountPage ? (
              <AccountPage
                onBackToHome={() => navigate('/')}
                onOpenAreaModal={() => setAreaModalOpen(true)}
              />
            ) : (
              <HomePage onOpenAreaModal={() => setAreaModalOpen(true)} />
            )}
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

      {/* Switch Store Confirmation Dialog */}
      <SwitchStoreModal />

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

      {/* 5. In-App Notifications & Alerts Modal */}
      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
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
