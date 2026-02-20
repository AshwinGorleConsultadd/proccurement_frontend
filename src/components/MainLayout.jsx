
import { Outlet } from "react-router-dom"
import { AppSidebar } from "./AppSidebar"
import { useIsMobile } from "../hooks/use-mobile"

export function MainLayout() {
    const isMobile = useIsMobile()

    return (
        <div className="flex bg-background min-h-screen">
            <AppSidebar />
            {/* 
                Main content always has a left margin equal to the *collapsed* sidebar width (4.5rem).
                The sidebar expands *over* the content on hover, so there's no layout shift.
            */}
            <main className={`flex-1 transition-all duration-300 ${isMobile ? "" : "ml-[4.5rem]"}`}>
                <Outlet />
            </main>
        </div>
    )
}
