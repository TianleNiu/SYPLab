/* SYPLab navigation: highlight the section currently in view */
(function () {
    const links = [...document.querySelectorAll(".nav a[href^='#']")];
    const sections = links
        .map(link => document.querySelector(link.getAttribute("href")))
        .filter(Boolean);

    function setActive(id) {
        for (const link of links) {
            const on = link.getAttribute("href") === "#" + id;
            link.classList.toggle("active", on);
            if (on) {
                link.setAttribute("aria-current", "true");
            } else {
                link.removeAttribute("aria-current");
            }
        }
    }

    function update() {
        // 滚到页面底部时，高亮最后一个板块（About 太短，无法滚到顶部）
        const atBottom = window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 4;
        if (atBottom) {
            setActive(sections[sections.length - 1].id);
            return;
        }

        // 否则高亮最后一个顶部已经越过导航栏下方的板块
        let current = sections[0];
        for (const section of sections.slice(1)) {
            if (section.getBoundingClientRect().top <= 120) {
                current = section;
            }
        }
        setActive(current.id);
    }

    let ticking = false;
    window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            update();
            ticking = false;
        });
    }, { passive: true });

    window.addEventListener("resize", update);
    update();
})();
