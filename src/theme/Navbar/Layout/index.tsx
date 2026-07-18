import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {ThemeClassNames, useThemeConfig} from '@docusaurus/theme-common';
import {useHideableNavbar} from '@docusaurus/theme-common/internal';
import {translate} from '@docusaurus/Translate';
import NavbarMobileSidebar from '@theme/Navbar/MobileSidebar';
import type {Props} from '@theme/Navbar/Layout';

import styles from './styles.module.css';

/**
 * Mobile nav drawer is portaled to document.body (see Navbar/MobileSidebar).
 * Keeping it inside <nav> traps fixed positioning in Chrome/Safari.
 */
export default function NavbarLayout({children}: Props): ReactNode {
  const {
    navbar: {hideOnScroll, style},
  } = useThemeConfig();
  const {navbarRef, isNavbarVisible} = useHideableNavbar(hideOnScroll);

  return (
    <>
      <nav
        ref={navbarRef}
        aria-label={translate({
          id: 'theme.NavBar.navAriaLabel',
          message: 'Main',
          description: 'The ARIA label for the main navigation',
        })}
        className={clsx(
          ThemeClassNames.layout.navbar.container,
          'navbar',
          'navbar--fixed-top',
          hideOnScroll && [
            styles.navbarHideable,
            !isNavbarVisible && styles.navbarHidden,
          ],
          {
            'navbar--dark': style === 'dark',
            'navbar--primary': style === 'primary',
          },
        )}>
        {children}
      </nav>
      <NavbarMobileSidebar />
    </>
  );
}
