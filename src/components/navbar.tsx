"use client";

import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
} from "@nextui-org/navbar";
import { Link } from "@nextui-org/link";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { useState } from "react";
import { InstagramIcon, Menu, X, ChevronDown, Settings } from "lucide-react";
import { TwitterIcon, DiscordIcon } from "@/components/icons";
import { useCMSUser } from "@/hooks/useCMSUser";

export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
};

export type NavDropdown = {
  label: string;
  items: NavLink[];
};

export type NavItem = NavLink | NavDropdown;

export type SocialLink = {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
};

const isDropdown = (item: NavItem): item is NavDropdown => {
  return "items" in item;
};

const gamesDropdown: NavDropdown = {
  label: "GAMES",
  items: [
    {
      label: "The Runiverse Game",
      href: "https://game.runiverse.world/",
      external: true,
    },
    {
      label: "Shucks - Pumpkin Panic",
      href: "https://feckless.dev/shucks/",
      external: true,
    },
    {
      label: "Runes TCG",
      href: "https://www.runes-tcg.com/",
      external: true,
    },
  ],
};

const magicDropdown: NavDropdown = {
  label: "MAGIC",
  items: [
    {
      label: "The Guard",
      href: "/guard",
    },
    {
      label: "Forgotten Tomes",
      href: "https://forgotten-tomes.vercel.app/",
      external: true,
    },
    {
      label: "The Pyre",
      href: "https://forgottenrunes.com/burning",
      external: true,
    },
    {
      label: "Warrior's Forge",
      href: "https://forgottenrunes.com/warriors/forge",
      external: true,
    },
    {
      label: "Nightmare Imp's Door",
      href: "https://forgottenrunes.com/nightmareimp",
      external: true,
    },
    {
      label: "Lorb",
      href: "https://cabinetofcuriosities.xyz/lorb",
      external: true,
    },
    {
      label: "Enchanted Mirror",
      href: "https://cabinetofcuriosities.xyz/mirror",
      external: true,
    },
  ],
};

const daoDropdown: NavDropdown = {
  label: "DAO",
  items: [
    {
      label: "About",
      href: "/about",
    },
    {
      label: "Documents",
      href: "/documents",
    },
    {
      label: "Vote",
      href: "https://snapshot.org/#/forgottengov.eth",
      external: true,
    },
  ],
};

const toolsDropdown: NavDropdown = {
  label: "TOOLS",
  items: [
    {
      label: "Marketplace",
      href: "/marketplace",
    },
    {
      label: "Burns",
      href: "/burns",
    },
    {
      label: "Forge",
      href: "/warriors/forged",
    },
    {
      label: "Gallery",
      href: "/gallery",
    },
    {
      label: "Lore Leaderboard",
      href: "https://cabinetofcuriosities.xyz/leaderboard",
      external: true,
    },
    {
      label: "Wizzypedia",
      href: "https://wizzypedia.forgottenrunes.com",
      external: true,
    },
  ],
};

const shopDropdown: NavDropdown = {
  label: "SHOP",
  items: [
    {
      label: "Marketplace",
      href: "/marketplace",
    },
    {
      label: "PFP Mint",
      href: "/pfp-mint",
    },
  ],
};

const navigationItems: NavItem[] = [
  {
    label: "Characters",
    href: "/characters",
  },
  {
    label: "Art",
    href: "/art",
  },
  {
    label: "Gaming Hub",
    href: "/gaming-hub",
  },
  shopDropdown,
  magicDropdown,
  toolsDropdown,
  gamesDropdown,
  daoDropdown,
];

const socialLinks: SocialLink[] = [
  {
    href: "https://x.com/FRWCCouncil",
    title: "Twitter",
    icon: TwitterIcon,
  },
  {
    href: "https://instagram.com/house_of_wizards_dao",
    title: "Instagram",
    icon: InstagramIcon,
  },
  {
    href: "https://discord.gg/forgottenrunes",
    title: "Discord",
    icon: DiscordIcon,
  },
];

const ExternalLinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
      clipRule="evenodd"
    />
    <path
      fillRule="evenodd"
      d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
      clipRule="evenodd"
    />
  </svg>
);

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpandedDropdown, setMobileExpandedDropdown] = useState<
    string | null
  >(null);
  const pathname = usePathname();
  const { hasCMSAccess } = useCMSUser();
  const isActiveLink = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isDropdownActive = (dropdown: NavDropdown) => {
    return dropdown.items.some(
      (item) => !item.external && isActiveLink(item.href),
    );
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
    setMobileExpandedDropdown(null);
  };

  return (
    <NextUINavbar
      className="sm:p-8 p-4"
      maxWidth="xl"
      position="static"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 shrink-0">
          <NextLink
            className="flex justify-start items-center gap-1 shrink-0"
            href="/"
          >
            <Image
              alt="HowDAO logo"
              className="rounded-none"
              height={50}
              priority={true}
              src="/img/logo-white.png"
              width={150}
            />
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop Navigation Links */}
      <NavbarContent className="hidden lg:flex gap-6 justify-start ml-2 uppercase">
        {navigationItems.map((item) => {
          if (isDropdown(item)) {
            return (
              <NavbarItem key={item.label}>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === item.label}
                    onClick={() =>
                      setOpenDropdown(
                        openDropdown === item.label ? null : item.label,
                      )
                    }
                    className={`flex items-center gap-1.5 text-sm hover:text-brand-500 transition-colors ${isDropdownActive(item) ? "underline underline-offset-4" : ""}`}
                  >
                    {item.label}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${openDropdown === item.label ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openDropdown === item.label && (
                    <ul
                      role="menu"
                      className="absolute top-full left-0 pt-2 min-w-[200px] z-50"
                    >
                      <div className="bg-black/95 backdrop-blur-sm border border-neutral-700 rounded-md py-2">
                        {item.items.map((subItem) => (
                          <li key={subItem.href} role="none">
                            {subItem.external ? (
                              <a
                                role="menuitem"
                                className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-800 hover:text-brand-500 transition-colors text-white`}
                                href={subItem.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {subItem.label}
                                <ExternalLinkIcon />
                              </a>
                            ) : (
                              <NextLink
                                role="menuitem"
                                className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-800 hover:text-brand-500 transition-colors ${isActiveLink(subItem.href) ? "text-brand-500" : "text-white"}`}
                                href={subItem.href}
                                onClick={() => setOpenDropdown(null)}
                              >
                                {subItem.label}
                              </NextLink>
                            )}
                          </li>
                        ))}
                      </div>
                    </ul>
                  )}
                </div>
              </NavbarItem>
            );
          }

          return (
            <NavbarItem
              key={item.href}
              className="text-sm hover:text-brand-500 transition-colors"
            >
              <NextLink
                className={`flex items-center gap-2 ${isActiveLink(item.href) ? "underline underline-offset-4" : ""}`}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                {item.label}
                {item.icon}
              </NextLink>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      {/* Desktop Social Links & Connect Button */}
      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-4 items-center">
          {socialLinks.map((social) => {
            const IconComponent = social.icon;
            return (
              <Link
                key={social.href}
                isExternal
                href={social.href}
                title={social.title}
              >
                <IconComponent className="text-white hover:text-brand-500" />
              </Link>
            );
          })}
          {hasCMSAccess && (
            <NextLink
              href="/cms"
              className="p-2 text-neutral-400 hover:text-brand-500 transition-colors"
              title="CMS"
            >
              <Settings className="w-5 h-5" />
            </NextLink>
          )}
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="avatar"
          />
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu Button */}
      <NavbarContent className="lg:hidden basis-1 pl-4" justify="end">
        <NavbarItem>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white hover:text-brand-500 transition-colors p-2"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            type="button"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="bg-black/95 backdrop-blur-sm z-[9999] fixed inset-0 lg:hidden">
          <div className="mx-4 mt-4 flex flex-col gap-2">
            {/* Close Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-white hover:text-brand-500 transition-colors p-2"
                aria-label="Close menu"
                type="button"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {navigationItems.map((item) => {
              if (isDropdown(item)) {
                const isExpanded = mobileExpandedDropdown === item.label;
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setMobileExpandedDropdown(
                          isExpanded ? null : item.label,
                        )
                      }
                      className={`text-white text-lg uppercase w-full flex items-center justify-between py-2 hover:text-brand-500 transition-colors ${isDropdownActive(item) ? "underline underline-offset-4" : ""}`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="pl-4 border-l border-neutral-700 ml-2 mt-1 mb-2">
                        {item.items.map((subItem) => (
                          <NextLink
                            key={subItem.href}
                            className={`text-white text-base uppercase w-full flex items-center gap-2 py-2 hover:text-brand-500 transition-colors ${isActiveLink(subItem.href) ? "text-brand-500" : ""}`}
                            href={subItem.href}
                            target={subItem.external ? "_blank" : undefined}
                            rel={
                              subItem.external
                                ? "noopener noreferrer"
                                : undefined
                            }
                            onClick={handleLinkClick}
                          >
                            {subItem.label}
                            {subItem.external && <ExternalLinkIcon />}
                          </NextLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.href}>
                  <NextLink
                    className={`text-white text-lg uppercase w-full flex items-center gap-2 py-2 hover:text-brand-500 transition-colors ${isActiveLink(item.href) ? "underline underline-offset-4" : ""}`}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={handleLinkClick}
                  >
                    {item.label}
                    {item.external && <ExternalLinkIcon />}
                  </NextLink>
                </div>
              );
            })}
            {hasCMSAccess && (
              <div className="mt-4 pt-4 border-t border-neutral-700">
                <NextLink
                  href="/cms"
                  onClick={handleLinkClick}
                  className="text-brand-400 text-lg uppercase w-full flex items-center gap-2 py-2 hover:text-brand-300 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  CMS
                </NextLink>
              </div>
            )}
            <div className="mt-6 pt-6 border-t border-neutral-700">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 justify-start">
                  {socialLinks.map((social) => {
                    const IconComponent = social.icon;
                    return (
                      <Link
                        key={social.href}
                        isExternal
                        href={social.href}
                        title={social.title}
                        onClick={handleLinkClick}
                      >
                        <IconComponent className="text-white hover:text-brand-500 transition-colors w-6 h-6" />
                      </Link>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <ConnectButton
                    chainStatus="icon"
                    showBalance={false}
                    accountStatus="full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </NextUINavbar>
  );
};
