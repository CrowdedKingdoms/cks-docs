import React, {useEffect, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useLockBodyScroll} from '@docusaurus/theme-common/internal';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarMobileSidebarLayout from '@theme/Navbar/MobileSidebar/Layout';
import NavbarMobileSidebarHeader from '@theme/Navbar/MobileSidebar/Header';
import NavbarMobileSidebarPrimaryMenu from '@theme/Navbar/MobileSidebar/PrimaryMenu';
import NavbarMobileSidebarSecondaryMenu from '@theme/Navbar/MobileSidebar/SecondaryMenu';

export default function NavbarMobileSidebar(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLockBodyScroll(mobileSidebar.shown);

  useEffect(() => {
    document.documentElement.classList.toggle(
      'cks-mobile-nav-open',
      mobileSidebar.shown,
    );
    return () => {
      document.documentElement.classList.remove('cks-mobile-nav-open');
    };
  }, [mobileSidebar.shown]);

  if (!mounted || !mobileSidebar.shown || mobileSidebar.disabled) {
    return null;
  }

  return createPortal(
    <div className="cks-mobile-nav-root" role="presentation">
      <button
        type="button"
        className="cks-mobile-nav-backdrop"
        aria-label="Close navigation menu"
        onClick={mobileSidebar.toggle}
      />
      <div className="cks-mobile-nav-drawer">
        <NavbarMobileSidebarLayout
          header={<NavbarMobileSidebarHeader />}
          primaryMenu={<NavbarMobileSidebarPrimaryMenu />}
          secondaryMenu={<NavbarMobileSidebarSecondaryMenu />}
        />
      </div>
    </div>,
    document.body,
  );
}
