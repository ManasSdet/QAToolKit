function collectPageInformation() {

    const links = Array.from(
        document.querySelectorAll("a[href]")
    ).map(a => ({
        text: a.innerText.trim(),
        href: a.href
    }));

    const images = Array.from(
        document.images
    ).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight
    }));

    const headings = Array.from(
        document.querySelectorAll(
            "h1,h2,h3,h4,h5,h6"
        )
    ).map(h => ({
        tag: h.tagName,
        text: h.innerText.trim()
    }));

    const buttons = Array.from(
        document.querySelectorAll(
            "button,input[type='button'],input[type='submit']"
        )
    ).map(button =>
        button.innerText ||
        button.value ||
        ""
    );

    const forms =
        document.querySelectorAll("form").length;

    return {

        url: location.href,

        title: document.title,

        h1: document.querySelector("h1")
            ?.innerText
            ?.trim() || "",

        links,

        images,

        headings,

        buttons,

        forms,

        bodyText:
            document.body.innerText.trim(),

        timestamp:
            new Date().toISOString()

    };
}

collectPageInformation();