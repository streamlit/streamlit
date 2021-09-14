import streamlit as st


def draw_lorem_ipsum():
    st.write(
        """
    # Lorem ipsum dolor sit amet

    Consectetur adipiscing elit. Cras consectetur venenatis diam vitae
    bibendum. Curabitur aliquet cursus orci nec pellentesque. Aenean at massa a justo tincidunt
    fermentum. Vivamus consectetur scelerisque elit. Praesent erat nisl, placerat eget enim dapibus,
    vulputate consequat lectus.

    ## Integer fermentum convallis lacus

    Nullam tincidunt tortor quis bibendum sollicitudin.

    ### Eget maximus justo laoreet ut

    Fusce pulvinar dignissim elit at maximus. Phasellus dignissim porttitor pharetra. Duis mollis sapien
    sem, id blandit risus efficitur id. Aliquam erat volutpat. Fusce finibus massa ac sapien tincidunt
    volutpat. Nulla sem sapien, tincidunt sed erat sit amet, sodales aliquam nisl. Nulla gravida
    scelerisque aliquet. Integer sed turpis suscipit, imperdiet lorem nec, pharetra ligula. Curabitur
    tincidunt arcu vitae odio vehicula tincidunt. In suscipit eget ipsum nec pellentesque. Cras quis
    lectus lorem. Ut sit amet ipsum aliquam, sagittis leo sit amet, varius nunc. Etiam a mi ac erat
    placerat efficitur. Integer imperdiet magna sed nunc bibendum mollis.

    ### Vivamus feugiat ligula in dui varius

    Vestibulum rhoncus lobortis ex, sit amet ultrices dolor pulvinar nec. Fusce consectetur aliquet
    neque, id elementum sem vulputate et. Vivamus dictum vel turpis vitae ornare. Cras vel odio lectus.
    Sed vehicula metus convallis. Suspendisse hendrerit urna vel
    facilisis dictum. Nam vitae eleifend arcu, quis eleifend neque. Nullam fringilla, massa nec posuere
    condimentum.

    ## Lacus magna lobortis purus

    Id imperdiet mauris felis nec nisl. Fusce bibendum
    porttitor quam vel rutrum. Integer nec tincidunt mauris, nec molestie dolor. Praesent a ornare
    risus, non lacinia est.

    * Curabitur efficitur enim ut hendrerit finibus.
    * Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Curabitur a cursus leo.
    * Phasellus porttitor risus augue, vitae convallis dolor lacinia ac. Quisque bibendum, nunc ac hendrerit ullamcorper.

    Mi erat volutpat quam, sed convallis mauris risus nec ex. Quisque et finibus eros, vel blandit dui.
    Nulla malesuada rhoncus rutrum. Proin tempor ipsum tortor, dapibus congue est fringilla sed.

    In ultricies mattis ligula quis commodo. Quisque at ante ultricies libero cursus molestie quis ac
    enim. Quisque molestie arcu sit amet risus euismod luctus. Nunc feugiat sodales purus id consequat.
    Donec at gravida leo, id convallis augue. Cras accumsan quam eu ex sodales, ac commodo nibh iaculis.
    Sed in pellentesque elit. Duis consectetur et risus vitae iaculis. Donec sed erat nulla. Sed
    pulvinar tellus neque, non hendrerit odio dapibus eu. Nullam convallis tempus tellus sed
    scelerisque. Integer commodo faucibus sapien, eget egestas libero. Fusce facilisis ligula hendrerit
    pellentesque suscipit. Phasellus ut porta nisi. Duis luctus aliquam mauris.

    Orci varius natoque penatibus et magnis dis parturient
    montes, nascetur ridiculus mus. Donec consequat, mi et aliquam elementum, est diam porttitor est,
    pharetra hendrerit lorem ligula ac erat. Phasellus sit amet massa sit amet dui rutrum faucibus nec
    ut ipsum. Nullam sed convallis urna. Ut volutpat velit sed condimentum varius. Vestibulum et
    faucibus urna. Quisque eget velit a lacus sodales dignissim eget pellentesque purus. Phasellus
    placerat rutrum pellentesque. Integer interdum ante commodo tellus iaculis, sed rutrum nunc auctor.
    Proin ex eros, auctor at odio non, egestas rhoncus nisl.
    """
    )


def draw_header_test(joined=False):
    strings = [
        "# Header header",
        "## Header header",
        "### Header header",
        "#### Header header",
        "##### Header header",
        "###### Header header",
        "Quisque vel blandit mi. Fusce dignissim leo purus, in imperdiet lectus suscipit nec.",
    ]

    if joined:
        st.write("\n\n".join(strings))
    else:
        for string in strings:
            st.write(string)


draw_lorem_ipsum()

with st.sidebar:
    st.text_input("This is a label", key="1")
    draw_lorem_ipsum()
    draw_header_test()

"---"

"Text above header"

draw_header_test(True)

"---"

"Text above header"

draw_header_test(False)

"---"

"Text outside columns"

a, b = st.columns(2)

with a:
    draw_header_test(True)

with b:
    draw_header_test(False)

"---"

"Text outside columns"

a, b = st.columns(2)

with a:
    "This is some text"
    draw_header_test(True)

with b:
    "This is some text"
    with st.container():
        draw_header_test(False)

"---"

a, b = st.columns(2)

with a:
    "# Header header"
    "## Header header"

with b:
    st.text_input("This is a label", key="2")
