import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function ApplicationLoading() {
    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
            </div>

            <div className="container py-6 space-y-8">
                {/* Header Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <Skeleton className="h-6 w-32" />
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <Skeleton className="h-24 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-5 w-32" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Separator />

                {/* Tabs Loading */}
                <div className="space-y-6">
                    <div className="flex gap-2">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-24" />
                        ))}
                    </div>
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
