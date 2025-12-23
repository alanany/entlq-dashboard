   <aside id="sidebar" class="fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-gray-100 transition-transform duration-300 sidebar-closed lg:translate-x-0 lg:static lg:block shadow-2xl lg:shadow-none">
            <div class="h-20 flex items-center justify-between px-6 border-b border-gray-50">
                <span class="text-2xl font-black text-indigo-600">لوحة المعلم</span>
                <button onclick="toggleSidebar()" class="lg:hidden p-2 text-gray-400">
                    <i data-feather="x"></i>
                </button>
            </div>
            
            <nav class="p-4 space-y-2 overflow-y-auto h-[calc(100vh-80px)]">
                <a href="/teacher/home" class="active-link flex items-center px-4 py-3.5 rounded-2xl transition-all font-bold">
                    <i data-feather="grid" class="ml-3 w-5 h-5"></i> الرئيسية
                </a>
                <a href="#" class="flex items-center px-4 py-3.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all font-medium">
                    <i data-feather="users" class="ml-3 w-5 h-5"></i> الطلاب المشتركين
                </a>
                <a href="/teacher/schedule" class="flex items-center px-4 py-3.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all font-medium">
                    <i data-feather="calendar" class="ml-3 w-5 h-5"></i> جدول المواعيد
                </a>
                <a href="#" class="flex items-center px-4 py-3.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all font-medium">
                    <i data-feather="book-open" class="ml-3 w-5 h-5"></i> إدارة الكورسات
                </a>
                <div class="pt-4 mt-4 border-t border-gray-100">
                     <a href="#" onclick="openLogoutModal(event)" class="flex items-center justify-center p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium">
            <i data-feather="log-out" class="ml-2 w-5 h-5"></i>
            تسجيل الخروج
        </a>
                </div>
            </nav>
        </aside>