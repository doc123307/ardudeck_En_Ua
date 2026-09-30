# ardudeck-wfb-rx - headless wfb-ng receiver sidecar for ArduDeck.
#
# Vendors the radio stack from OpenIPC Aviateur (src/wifi, 3rd/devourer) and
# replaces its GUI singleton with a terminal shim (src/gui_interface.h).
# Mirrors Aviateur's build flags for those sources; no GUI, no player, no
# video decode - output is RTP over UDP for ArduDeck's media engine.
#
# Build:
#   cmake -B build -DCMAKE_BUILD_TYPE=Release
#   cmake --build build -j8
# Deps (macOS): brew install cmake libusb libsodium
# Deps (Linux): libusb-1.0-0-dev libudev-dev libsodium-dev libpcap-dev
# Windows (MSVC): vcpkg libusb + libsodium, triplet x64-windows-static (mirrors Aviateur).
# Windows (cross from macOS/Linux): scripts/build-win-mingw.sh
#
# The release binary is downloaded on its own (no DLLs, no Homebrew), so
# libusb and libsodium are linked statically by default (WFB_RX_STATIC_DEPS).

cmake_minimum_required(VERSION 3.18)

if (CMAKE_HOST_WIN32 AND NOT CMAKE_TOOLCHAIN_FILE AND DEFINED ENV{VCPKG_ROOT})
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake")
endif ()

project(ardudeck-wfb-rx
        VERSION 0.1.0
        LANGUAGES C CXX)

option(WFB_RX_STATIC_DEPS "Link libusb and libsodium statically" ON)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_INCLUDE_CURRENT_DIR ON)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

if (MSVC AND VCPKG_TARGET_TRIPLET MATCHES "-static$")
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif ()

# Prefer .a archives; set before any pkg_check_modules so devourer's libusb lookup sees it too.
if (WFB_RX_STATIC_DEPS AND NOT MSVC)
    set(CMAKE_FIND_LIBRARY_SUFFIXES .a)
endif ()

find_package(PkgConfig REQUIRED)

if (MSVC)
    pkg_check_modules(LIBUSB REQUIRED IMPORTED_TARGET libusb-1.0)
    find_package(unofficial-sodium CONFIG REQUIRED)
    set(WFB_RX_SODIUM unofficial-sodium::sodium)
else ()
    pkg_check_modules(LIBSODIUM REQUIRED IMPORTED_TARGET libsodium)
    set(WFB_RX_SODIUM PkgConfig::LIBSODIUM)
endif ()

add_executable(${PROJECT_NAME}
        src/main.cpp
        src/gui_interface.h
)

# The vendored wifi CMakeLists attaches its sources to ${PROJECT_NAME}.
add_subdirectory(src/wifi)

# SIMD FEC flags, mirrored from Aviateur.
target_compile_definitions(${PROJECT_NAME} PRIVATE
        ZFEX_UNROLL_ADDMUL_SIMD=8
        ZFEX_USE_INTEL_SSSE3
        ZFEX_USE_ARM_NEON
        ZFEX_INLINE_ADDMUL
        ZFEX_INLINE_ADDMUL_SIMD
)

# EXCLUDE_FROM_ALL: only WiFiDriver is needed, not devourer's demo programs.
add_subdirectory(3rd/devourer EXCLUDE_FROM_ALL)
target_include_directories(${PROJECT_NAME} PRIVATE
        "src"
        "3rd/devourer/src"
        "3rd/devourer/hal"
        "src/wifi/wfb-ng/include"
)

target_link_libraries(${PROJECT_NAME} PRIVATE ${WFB_RX_SODIUM} WiFiDriver)

if (WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE ws2_32)
    if (MSVC)
        target_compile_options(${PROJECT_NAME} PRIVATE /utf-8)
        target_link_libraries(${PROJECT_NAME} PRIVATE PkgConfig::LIBUSB)
        if (VCPKG_TARGET_TRIPLET MATCHES "-static$")
            target_compile_definitions(${PROJECT_NAME} PRIVATE SODIUM_STATIC)
        endif ()
    else ()
        # MinGW: sources include <libusb-1.0/libusb.h>, htonll needs Win8+ headers,
        # and -static folds the C++ runtime and winpthread into the exe.
        pkg_get_variable(WFB_RX_USB_INCLUDEDIR libusb-1.0 includedir)
        target_include_directories(WiFiDriver PRIVATE "${WFB_RX_USB_INCLUDEDIR}")
        target_include_directories(${PROJECT_NAME} PRIVATE "${WFB_RX_USB_INCLUDEDIR}")
        target_compile_definitions(${PROJECT_NAME} PRIVATE _WIN32_WINNT=0x0A00)
        target_link_options(${PROJECT_NAME} PRIVATE -static)
    endif ()
else ()
    target_link_libraries(${PROJECT_NAME} PRIVATE pcap)
    if (WFB_RX_STATIC_DEPS)
        # Static libusb's Libs.private, which the imported pkg-config target leaves out.
        if (APPLE)
            target_link_libraries(${PROJECT_NAME} PRIVATE
                    objc "-framework IOKit" "-framework CoreFoundation" "-framework Security")
        else ()
            target_link_libraries(${PROJECT_NAME} PRIVATE udev pthread)
        endif ()
    endif ()
endif ()
