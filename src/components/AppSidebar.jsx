
import {
    LayoutDashboard,
    Receipt,
    ShoppingCart,
    Users,
    Settings,
    FileText,
    Building2,
    ChevronRight,
    FolderOpen,
} from "lucide-react"
import { useLocation, Link } from "react-router-dom"
import { cn } from "../lib/utils"
import { useUI } from "../redux/hooks/ui/useUI"
import { useIsMobile } from "../hooks/use-mobile"
import { useEffect, useRef } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "./ui/tooltip"

const NAV_ITEMS = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Budget", url: "/budget", icon: Receipt },
    { title: "Procurement", url: "/procurement", icon: ShoppingCart },
    { title: "Floor Plans", url: "/floor-plans", icon: FileText },
    { title: "Projects", url: "/projects", icon: FolderOpen },
    { title: "Vendors", url: "/vendors", icon: Users },
    { title: "Settings", url: "/settings", icon: Settings },
]

export function AppSidebar() {
    const { sidebarOpen, sidebarMobileOpen, setSidebarOpen, toggleMobileSidebar, setMobileSidebarOpen } = useUI()
    const isMobile = useIsMobile()
    const location = useLocation()
    const hoverTimerRef = useRef(null)

    // Close mobile sidebar on navigation
    useEffect(() => {
        if (isMobile) setMobileSidebarOpen(false)
    }, [location.pathname, isMobile, setMobileSidebarOpen])

    const handleMouseEnter = () => {
        if (isMobile) return
        clearTimeout(hoverTimerRef.current)
        setSidebarOpen(true)
    }

    const handleMouseLeave = () => {
        if (isMobile) return
        hoverTimerRef.current = setTimeout(() => {
            setSidebarOpen(false)
        }, 150)
    }

    return (
        <TooltipProvider delayDuration={200}>
            {/* Mobile Overlay */}
            {isMobile && sidebarMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex h-full flex-col",
                    "bg-[#0f1117] border-r border-white/[0.06]",
                    "transition-all duration-300 ease-in-out",
                    "shadow-[4px_0_24px_rgba(0,0,0,0.4)]",
                    sidebarOpen ? "w-64" : "w-[4.5rem]",
                    isMobile && !sidebarMobileOpen && "-translate-x-full",
                    isMobile && sidebarMobileOpen && "translate-x-0 w-64"
                )}
            >
                {/* Header / Logo */}
                <div className="flex h-16 items-center border-b border-white/[0.06] px-4 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className={cn(
                            "flex flex-col transition-all duration-300 overflow-hidden",
                            sidebarOpen || (isMobile && sidebarMobileOpen) ? "w-auto opacity-100" : "w-0 opacity-0"
                        )}>
                            <span className="text-white font-semibold text-sm leading-tight whitespace-nowrap">Procurement</span>
                            <span className="text-white/40 text-xs whitespace-nowrap">& Co.</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
                    <nav className="grid gap-1 px-2">
                        {NAV_ITEMS.map((item) => {
                            const isActive = location.pathname === item.url
                            const content = (
                                <Link
                                    key={item.url}
                                    to={item.url}
                                    className={cn(
                                        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                                        "transition-all duration-200 group",
                                        isActive
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-white/50 hover:bg-white/5 hover:text-white/90",
                                        !sidebarOpen && !isMobile && "justify-center px-2"
                                    )}
                                >
                                    {/* Active indicator bar */}
                                    {isActive && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-gradient-to-b from-violet-400 to-indigo-400" />
                                    )}
                                    <item.icon className={cn(
                                        "h-4 w-4 shrink-0 transition-colors",
                                        isActive ? "text-violet-400" : "text-white/40 group-hover:text-white/70"
                                    )} />
                                    <span className={cn(
                                        "truncate transition-all duration-300",
                                        (sidebarOpen || (isMobile && sidebarMobileOpen)) ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                                    )}>
                                        {item.title}
                                    </span>
                                    {/* Collapse chevron for active on expanded */}
                                    {isActive && (sidebarOpen || (isMobile && sidebarMobileOpen)) && (
                                        <ChevronRight className="ml-auto h-3 w-3 text-white/30" />
                                    )}
                                </Link>
                            )

                            // Show tooltip label when collapsed
                            if (!sidebarOpen && !isMobile) {
                                return (
                                    <Tooltip key={item.url}>
                                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                                        <TooltipContent side="right" className="bg-[#1a1d27] text-white border-white/10">
                                            {item.title}
                                        </TooltipContent>
                                    </Tooltip>
                                )
                            }
                            return content
                        })}
                    </nav>
                </div>

                {/* Footer */}
                <div className="border-t border-white/[0.06] p-4 shrink-0">
                    <div className={cn(
                        "flex items-center gap-3 overflow-hidden transition-all duration-300",
                        !sidebarOpen && !isMobile ? "justify-center" : ""
                    )}>
                        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-violet-400">A</span>
                        </div>
                        <div className={cn(
                            "flex flex-col transition-all duration-300 overflow-hidden",
                            sidebarOpen || (isMobile && sidebarMobileOpen) ? "w-auto opacity-100" : "w-0 opacity-0"
                        )}>
                            <span className="text-white/80 text-xs font-medium whitespace-nowrap">Admin User</span>
                            <span className="text-white/30 text-xs whitespace-nowrap">admin@co.com</span>
                        </div>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    )
}
